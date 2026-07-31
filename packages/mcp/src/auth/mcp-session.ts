import type { Context } from "@sapphire2/api/context";

/** The non-null session shape protectedProcedure narrows ctx.session to. */
export type McpTrpcSession = NonNullable<Context["session"]>;

/** The fields we read off better-auth's OAuthAccessToken. */
export interface McpAccessToken {
	accessTokenExpiresAt: Date;
	scopes: string;
	userId?: string | null;
}

/** The better-auth user row, loaded by the Worker (packages/mcp stays db-free). */
export interface McpUser {
	createdAt: Date;
	email: string;
	emailVerified: boolean;
	id: string;
	image?: string | null;
	name: string;
	updatedAt: Date;
}

/**
 * Translate a verified OAuth access token + its user row into the tRPC
 * session shape. This is the ONLY place an MCP identity becomes a tRPC
 * session — procedures then run their protectedProcedure/ownership checks
 * against session.user.id exactly as they do for cookie-authenticated
 * requests. Returns null (caller must answer 401) when the token is
 * userless, the user row is gone, or the two disagree.
 */
export function buildMcpSession(
	token: McpAccessToken,
	user: McpUser | null | undefined
): McpTrpcSession | null {
	if (!(token.userId && user) || user.id !== token.userId) {
		return null;
	}
	// better-auth's getMcpSession looks tokens up by value only and never
	// checks expiry — enforce it here so a leaked old token stays dead.
	if (token.accessTokenExpiresAt.getTime() <= Date.now()) {
		return null;
	}
	const now = new Date();
	return {
		session: {
			// Synthetic record: MCP requests have no better-auth session row.
			// The empty token cannot collide with (or be replayed as) a real
			// session token.
			id: `mcp-${user.id}`,
			token: "",
			userId: user.id,
			expiresAt: token.accessTokenExpiresAt,
			createdAt: now,
			updatedAt: now,
			ipAddress: null,
			userAgent: "mcp",
		},
		user: {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			image: user.image ?? null,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		},
	} as McpTrpcSession;
}
