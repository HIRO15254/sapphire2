/**
 * MCP OAuth login continuation. When better-auth's authorize endpoint sees an
 * unauthenticated user it redirects to this app's /login carrying the original
 * authorize query. After sign-in, the login flow calls this helper to send the
 * browser back to the SERVER's authorize endpoint — never to any URL taken
 * from the query itself, which keeps open-redirect vectors closed: the
 * destination is fixed and only allowlisted OAuth parameters are forwarded.
 */

const OAUTH_AUTHORIZE_PARAMS = [
	"client_id",
	"response_type",
	"redirect_uri",
	"scope",
	"state",
	"code_challenge",
	"code_challenge_method",
	"nonce",
	"prompt",
	"max_age",
	"login_hint",
	"display",
	"resource",
] as const;

const TRAILING_SLASH = /\/$/;

function toRecord(
	search: Record<string, unknown> | string
): Record<string, unknown> {
	if (typeof search !== "string") {
		return search;
	}
	return Object.fromEntries(new URLSearchParams(search));
}

/**
 * Returns the absolute URL of the server's MCP authorize endpoint with the
 * OAuth query re-attached, or null when the current query is not an OAuth
 * authorize request (the normal, non-OAuth login case).
 */
export function resolveMcpAuthorizeRedirect(
	serverUrl: string,
	search: Record<string, unknown> | string
): string | null {
	const record = toRecord(search);
	if (
		typeof record.client_id !== "string" ||
		typeof record.response_type !== "string"
	) {
		return null;
	}
	const params = new URLSearchParams();
	for (const key of OAUTH_AUTHORIZE_PARAMS) {
		const value = record[key];
		if (typeof value === "string") {
			params.set(key, value);
		}
	}
	const base = serverUrl.replace(TRAILING_SLASH, "");
	return `${base}/api/auth/mcp/authorize?${params.toString()}`;
}
