export function forceConsentPrompt(url: string): string {
	const parsed = new URL(url);
	parsed.searchParams.set("prompt", "consent");
	return parsed.toString();
}

const TRAILING_SLASHES = /\/+$/;

export function isAuthorizePath(path: string): boolean {
	return path.replace(TRAILING_SLASHES, "").endsWith("/authorize");
}

function hostOf(candidate: string): string | undefined {
	try {
		return new URL(candidate).host || undefined;
	} catch {
		return undefined;
	}
}

export function redirectHostsFrom(
	redirectUrls: string | null | undefined
): string[] {
	if (!redirectUrls) {
		return [];
	}
	const hosts = new Set<string>();
	for (const candidate of redirectUrls.split(",")) {
		const host = hostOf(candidate.trim());
		if (host) {
			hosts.add(host);
		}
	}
	return [...hosts];
}

export interface ConsentPageQuery {
	clientId: string;
	code: string;
}

export function parseConsentPageQuery(url: string): ConsentPageQuery | null {
	const params = new URL(url).searchParams;
	const code = params.get("consent_code");
	const clientId = params.get("client_id");
	if (!(code && clientId)) {
		return null;
	}
	return { clientId, code };
}
