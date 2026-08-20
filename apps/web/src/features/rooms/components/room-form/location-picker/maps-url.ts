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
