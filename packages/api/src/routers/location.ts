import { TRPCError } from "@trpc/server";
import z from "zod";
import { protectedProcedure, router } from "../index";

const SHORT_MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

const GOOGLE_HOST_RE =
	/^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/u;

function hostnameOf(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		return url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port
			? url.hostname.toLowerCase()
			: null;
	} catch {
		return null;
	}
}

export function isShortMapsUrl(rawUrl: string): boolean {
	const host = hostnameOf(rawUrl);
	return host !== null && SHORT_MAPS_HOSTS.has(host);
}

export function isGoogleMapsUrl(rawUrl: string): boolean {
	const host = hostnameOf(rawUrl);
	if (host === null) {
		return false;
	}
	return SHORT_MAPS_HOSTS.has(host) || GOOGLE_HOST_RE.test(host);
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function inRange(latitude: number, longitude: number): boolean {
	return (
		latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
	);
}

const MAX_SHORT_MAPS_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_PLACES_RESPONSE_BYTES = 1_000_000;

async function readLimitedJson(response: Response): Promise<unknown> {
	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error("Missing response body");
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			size += value.byteLength;
			if (size > MAX_PLACES_RESPONSE_BYTES) {
				throw new Error("Response too large");
			}
			chunks.push(value);
		}
	} finally {
		reader.cancel().catch(() => undefined);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}

function unresolvedShortLink(): TRPCError {
	return new TRPCError({
		code: "BAD_REQUEST",
		message: "Could not resolve the link",
	});
}

async function resolveShortMapsUrl(initialUrl: string): Promise<string> {
	const visited = new Set([initialUrl]);
	let currentUrl = initialUrl;

	for (let redirects = 0; redirects < MAX_SHORT_MAPS_REDIRECTS; redirects++) {
		let response: Response;
		try {
			response = await fetch(currentUrl, {
				credentials: "omit",
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; Sapphire2/1.0)",
				},
				redirect: "manual",
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			response.body?.cancel().catch(() => undefined);
		} catch {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Could not resolve the link",
			});
		}

		if (response.status < 300 || response.status >= 400) {
			throw unresolvedShortLink();
		}

		const location = response.headers.get("location");
		if (!location) {
			throw unresolvedShortLink();
		}

		let nextUrl: string;
		try {
			nextUrl = new URL(location, currentUrl).toString();
		} catch {
			throw unresolvedShortLink();
		}

		if (!isGoogleMapsUrl(nextUrl) || visited.has(nextUrl)) {
			throw unresolvedShortLink();
		}
		if (!isShortMapsUrl(nextUrl)) {
			return nextUrl;
		}

		visited.add(nextUrl);
		currentUrl = nextUrl;
	}

	throw unresolvedShortLink();
}

const COORD_PATTERNS = [
	/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)(?![\d.])/u,
	/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?![\d.])/u,
	/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?![\d.])/u,
];

export function extractCoordsFromMapsUrl(
	url: string
): { latitude: number; longitude: number } | null {
	for (const candidate of [url, safeDecode(url)]) {
		for (const pattern of COORD_PATTERNS) {
			const match = candidate.match(pattern);
			if (!(match?.[1] && match[2])) {
				continue;
			}
			const latitude = Number.parseFloat(match[1]);
			const longitude = Number.parseFloat(match[2]);
			if (
				Number.isFinite(latitude) &&
				Number.isFinite(longitude) &&
				inRange(latitude, longitude)
			) {
				return { latitude, longitude };
			}
		}
	}
	return null;
}

const placesResponseSchema = z.object({
	places: z
		.array(
			z.object({
				displayName: z.object({ text: z.string().optional() }).optional(),
				formattedAddress: z.string().optional(),
				location: z
					.object({
						latitude: z.number().min(-90).max(90),
						longitude: z.number().min(-180).max(180),
					})
					.optional(),
			})
		)
		.optional(),
});

export const locationRouter = router({
	resolveLink: protectedProcedure
		.input(z.object({ url: z.string().url() }))
		.mutation(async ({ input }) => {
			if (!isGoogleMapsUrl(input.url)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Not a Google Maps link",
				});
			}

			const finalUrl = isShortMapsUrl(input.url)
				? await resolveShortMapsUrl(input.url)
				: input.url;

			const coords = extractCoordsFromMapsUrl(finalUrl);
			if (!coords) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Could not find coordinates in the link",
				});
			}
			return coords;
		}),
	search: protectedProcedure
		.input(z.object({ query: z.string().min(1).max(200) }))
		.mutation(async ({ ctx, input }) => {
			if (!ctx.googleMapsApiKey) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message:
						"Place search is not configured (missing GOOGLE_MAPS_API_KEY)",
				});
			}

			let res: Response;
			let data: z.infer<typeof placesResponseSchema>;
			try {
				res = await fetch(
					"https://places.googleapis.com/v1/places:searchText",
					{
						body: JSON.stringify({
							languageCode: "ja",
							regionCode: "JP",
							textQuery: input.query,
						}),
						credentials: "omit",
						headers: {
							"Content-Type": "application/json",
							"X-Goog-Api-Key": ctx.googleMapsApiKey,
							"X-Goog-FieldMask":
								"places.displayName,places.formattedAddress,places.location",
						},
						method: "POST",
						redirect: "manual",
						signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
					}
				);
				if (!res.ok) {
					res.body?.cancel().catch(() => undefined);
					throw new Error("Place search failed");
				}
				data = placesResponseSchema.parse(await readLimitedJson(res));
			} catch {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Place search failed",
				});
			}

			return (data.places ?? [])
				.filter((p) => p.location !== undefined)
				.slice(0, 5)
				.map((p) => ({
					address: p.formattedAddress ?? "",
					latitude: p.location?.latitude as number,
					longitude: p.location?.longitude as number,
					name: p.displayName?.text ?? "",
				}));
		}),
});
