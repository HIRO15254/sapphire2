import { TRPCError } from "@trpc/server";
import z from "zod";
import { protectedProcedure, router } from "../index";

// Short-link hosts are the only URLs we ever fetch server-side (to follow the
// redirect), so they are an exact allowlist — this bounds the SSRF surface.
const SHORT_MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

// `google.<tld>` or `*.google.<tld>`, where `google` is the registrable label
// immediately followed by the TLD: a gTLD (`com`), a 2-letter ccTLD (`google.de`)
// or a `co`/`com` second-level ccTLD (`google.co.jp`, `google.com.au`). This
// rejects lookalikes such as `evil-google.com`, `google.com.evil.com` AND
// `google.evil.com` (where `google` would be a subdomain of `evil.com`).
const GOOGLE_HOST_RE =
	/^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/;

function hostnameOf(rawUrl: string): string | null {
	try {
		return new URL(rawUrl).hostname.toLowerCase();
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

// Ordered by specificity: `!3d!4d` is the place's actual location, `@lat,lng`
// is the map viewport center, and `q=`/`ll=`/etc. cover share/query links.
const COORD_PATTERNS = [
	/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
	/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
	/[?&](?:q|query|ll|center|destination|daddr)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
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

interface PlacesTextSearchResponse {
	places?: Array<{
		displayName?: { text?: string };
		formattedAddress?: string;
		location?: { latitude?: number; longitude?: number };
	}>;
}

export const locationRouter = router({
	// Place name search via Google Places API (New) Text Search. Triggered by an
	// explicit search action (not per keystroke) to bound API cost.
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

			const res = await fetch(
				"https://places.googleapis.com/v1/places:searchText",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Goog-Api-Key": ctx.googleMapsApiKey,
						"X-Goog-FieldMask":
							"places.displayName,places.formattedAddress,places.location",
					},
					body: JSON.stringify({
						textQuery: input.query,
						languageCode: "ja",
						regionCode: "JP",
					}),
				}
			);

			if (!res.ok) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Place search failed",
				});
			}

			const data = (await res.json()) as PlacesTextSearchResponse;
			return (data.places ?? [])
				.filter(
					(p) =>
						typeof p.location?.latitude === "number" &&
						typeof p.location?.longitude === "number"
				)
				.slice(0, 5)
				.map((p) => ({
					name: p.displayName?.text ?? "",
					address: p.formattedAddress ?? "",
					latitude: p.location?.latitude as number,
					longitude: p.location?.longitude as number,
				}));
		}),

	// Extract coordinates from a pasted Google Maps link. Full URLs are parsed
	// directly; short links are resolved by following the redirect server-side
	// (the only outbound fetch, restricted to the short-link host allowlist).
	resolveLink: protectedProcedure
		.input(z.object({ url: z.string().url() }))
		.mutation(async ({ input }) => {
			if (!isGoogleMapsUrl(input.url)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Not a Google Maps link",
				});
			}

			let finalUrl = input.url;
			if (isShortMapsUrl(input.url)) {
				let res: Response;
				try {
					res = await fetch(input.url, {
						redirect: "follow",
						headers: {
							"User-Agent": "Mozilla/5.0 (compatible; Sapphire2/1.0)",
						},
					});
				} catch {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Could not resolve the link",
					});
				}
				finalUrl = res.url || input.url;
			}

			const coords = extractCoordsFromMapsUrl(finalUrl);
			if (!coords) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Could not find coordinates in the link",
				});
			}
			return coords;
		}),
});
