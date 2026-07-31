/**
 * Consent enforcement for the MCP OAuth provider.
 *
 * better-auth's mcp() authorize endpoint only routes through a consent step
 * when the CLIENT sends prompt=consent — otherwise an authenticated
 * browser hitting an authorize URL is silently issued a code, and the token
 * endpoint never re-checks consent. Since DCR is open to anyone, that would
 * let any registered client obtain user data with zero interaction. The
 * Worker therefore rewrites every authorize request to prompt=consent before
 * handing it to better-auth.
 */

/** Force prompt=consent on an authorize URL (overwrites any client value). */
export function forceConsentPrompt(url: string): string {
	const parsed = new URL(url);
	parsed.searchParams.set("prompt", "consent");
	return parsed.toString();
}

export interface ConsentPageQuery {
	clientId: string;
	code: string;
	scopes: string[];
}

/**
 * Parse the query better-auth appends when redirecting to the consent page
 * (consent_code, client_id, scope). Returns null when the request did not
 * come through the authorize flow.
 */
export function parseConsentPageQuery(url: string): ConsentPageQuery | null {
	const params = new URL(url).searchParams;
	const code = params.get("consent_code");
	const clientId = params.get("client_id");
	if (!(code && clientId)) {
		return null;
	}
	const scopes = (params.get("scope") ?? "")
		.split(" ")
		.filter((scope) => scope.length > 0);
	return { clientId, code, scopes };
}
