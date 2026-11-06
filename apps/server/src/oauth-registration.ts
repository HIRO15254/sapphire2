export const REGISTRATION_MAX_BODY_BYTES = 16 * 1024;
export const REGISTRATION_MAX_REDIRECT_URIS = 10;

const TRAILING_SLASHES = /\/+$/;

export function isRegistrationRequest(method: string, path: string): boolean {
	return (
		method === "POST" &&
		path.replace(TRAILING_SLASHES, "").endsWith("/oauth2/register")
	);
}

export function exceedsRedirectUriLimit(body: string): boolean {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return false;
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("redirect_uris" in parsed)
	) {
		return false;
	}
	return (
		Array.isArray(parsed.redirect_uris) &&
		parsed.redirect_uris.length > REGISTRATION_MAX_REDIRECT_URIS
	);
}
