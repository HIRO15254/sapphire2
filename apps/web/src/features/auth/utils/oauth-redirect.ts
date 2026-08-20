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
