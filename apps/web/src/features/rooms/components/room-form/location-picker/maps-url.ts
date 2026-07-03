// Short-link hosts + `google.<tld>` / `*.google.<tld>` (incl. `google.co.jp`),
// where `google` is the registrable label immediately followed by the TLD so
// lookalikes like `google.evil.com` are rejected. Mirrors the server-side
// allowlist in `packages/api/src/routers/location.ts`.
const MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);
const GOOGLE_HOST_RE =
	/^([a-z0-9-]+\.)*google\.(com|[a-z]{2}|(?:co|com)\.[a-z]{2})$/;

export function isGoogleMapsUrl(rawUrl: string): boolean {
	let host: string;
	try {
		host = new URL(rawUrl).hostname.toLowerCase();
	} catch {
		return false;
	}
	return MAPS_HOSTS.has(host) || GOOGLE_HOST_RE.test(host);
}
