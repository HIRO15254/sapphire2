export function forceConsentPrompt(url: string): string {
	const parsed = new URL(url);
	parsed.searchParams.set("prompt", "consent");
	return parsed.toString();
}

const TRAILING_SLASHES = /\/+$/;

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

export function redirectHostsFrom(redirectUris: unknown): string[] {
	if (!Array.isArray(redirectUris)) {
		return [];
	}
	const hosts = new Set<string>();
	for (const candidate of redirectUris) {
		const host = hostOf(candidate);
		if (host) {
			hosts.add(host);
		}
	}
	return [...hosts];
}

export interface ConsentPageQuery {
	clientId: string;
	oauthQuery: string;
}

export function parseConsentPageQuery(url: string): ConsentPageQuery | null {
	const params = new URL(url).searchParams;
	const clientId = params.get("client_id");
	if (!(clientId && params.get("sig"))) {
		return null;
	}
	return { clientId, oauthQuery: params.toString() };
}
