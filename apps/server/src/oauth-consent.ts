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

const LOGIN_PROMPT_COOKIE = "oidc_login_prompt";

export function stripLoginPromptCookie(
	cookieHeader: string | null | undefined
): string | null {
	const header = cookieHeader?.trim();
	if (!header) {
		return null;
	}
	const pairs = header.split(";").map((pair) => pair.trim());
	const kept = pairs.filter(
		(pair) => pair.split("=")[0]?.trim() !== LOGIN_PROMPT_COOKIE
	);
	if (kept.length === pairs.length) {
		return header;
	}
	return kept.length > 0 ? kept.join("; ") : null;
}

export function withoutLoginPromptCookie(request: Request): Request {
	const cookieHeader = request.headers.get("cookie");
	const stripped = stripLoginPromptCookie(cookieHeader);
	if (!cookieHeader || stripped === cookieHeader) {
		return request;
	}
	const headers = new Headers(request.headers);
	if (stripped) {
		headers.set("cookie", stripped);
	} else {
		headers.delete("cookie");
	}
	return new Request(request, { headers });
}
