// Short-link hosts + `google.<tld>` / `*.google.<tld>` (incl. `google.co.jp`).
// Mirrors the server-side allowlist in `packages/api/src/routers/location.ts`
// so the URL tab can validate before hitting the network.
const MAPS_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);
const GOOGLE_HOST_RE = /^([a-z0-9-]+\.)*google\.[a-z]{2,}(\.[a-z]{2,})?$/;

export function isGoogleMapsUrl(rawUrl: string): boolean {
	let host: string;
	try {
		host = new URL(rawUrl).hostname.toLowerCase();
	} catch {
		return false;
	}
	return MAPS_HOSTS.has(host) || GOOGLE_HOST_RE.test(host);
}
