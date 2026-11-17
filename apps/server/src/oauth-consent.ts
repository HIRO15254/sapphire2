export function forceConsentPrompt(url: string): string {
	const parsed = new URL(url);
	parsed.searchParams.set("prompt", "consent");
	return parsed.toString();
}

const TRAILING_SLASHES = /\/+$/u;

export function isAuthorizePath(path: string): boolean {
	return path.replace(TRAILING_SLASHES, "").endsWith("/authorize");
}

function hostOf(candidate: unknown): string | undefined {
	if (typeof candidate !== "string") {
		return undefined;
	}
	try {
		return new URL(candidate).host || undefined;
	} catch {
		return undefined;
	}
}

function registeredRedirectUris(stored: unknown): unknown[] {
	let value = stored;
	if (typeof value === "string") {
		try {
			value = JSON.parse(value);
		} catch {
			return [];
		}
	}
	return Array.isArray(value) ? value : [];
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK_PORT =
	/^(?<origin>http:\/\/[^/?#]*?)(?::\d*)?(?<rest>[/?#].*)?$/isu;

function withoutLoopbackPort(uri: string): string | undefined {
	try {
		const { hostname, protocol } = new URL(uri);
		if (!(protocol === "http:" && LOOPBACK_HOSTNAMES.has(hostname))) {
			return undefined;
		}
	} catch {
		return undefined;
	}
	const groups = LOOPBACK_PORT.exec(uri)?.groups;
	return groups ? `${groups.origin}${groups.rest ?? ""}` : undefined;
}

function isRegistered(registered: unknown[], requested: string): boolean {
	const requestedWithoutPort = withoutLoopbackPort(requested);
	return registered.some(
		(uri) =>
			uri === requested ||
			(requestedWithoutPort !== undefined &&
				typeof uri === "string" &&
				withoutLoopbackPort(uri) === requestedWithoutPort)
	);
}

export function destinationHostFrom(
	storedRedirectUris: unknown,
	requestedRedirectUri: string | null
): string | null {
	if (
		!(
			requestedRedirectUri &&
			isRegistered(
				registeredRedirectUris(storedRedirectUris),
				requestedRedirectUri
			)
		)
	) {
		return null;
	}
	return hostOf(requestedRedirectUri) ?? null;
}

export interface ConsentPageQuery {
	clientId: string;
	oauthQuery: string;
	redirectUri: string | null;
}

export function parseConsentPageQuery(url: string): ConsentPageQuery | null {
	const params = new URL(url).searchParams;
	const clientId = params.get("client_id");
	if (!(clientId && params.get("sig"))) {
		return null;
	}
	return {
		clientId,
		oauthQuery: params.toString(),
		redirectUri: params.get("redirect_uri"),
	};
}
