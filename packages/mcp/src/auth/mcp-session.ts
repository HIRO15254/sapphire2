import type { Context } from "@sapphire2/api/context";

export type McpTrpcSession = NonNullable<Context["session"]>;

export interface McpAccessToken {
	accessTokenExpiresAt: Date;
	scopes: string;
	userId?: string | null;
}

export interface McpUser {
	createdAt: Date;
	email: string;
	emailVerified: boolean;
	id: string;
	image?: string | null;
	name: string;
	updatedAt: Date;
}

export function buildMcpSession(
	token: McpAccessToken,
	user: McpUser | null | undefined
): McpTrpcSession | null {
	if (!(token.userId && user) || user.id !== token.userId) {
		return null;
	}
	if (token.accessTokenExpiresAt.getTime() <= Date.now()) {
		return null;
	}
	const now = new Date();
	return {
		session: {
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
