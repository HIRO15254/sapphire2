import type { Context } from "@sapphire2/api/context";

export type McpTrpcSession = NonNullable<Context["session"]>;

export interface McpAccessToken {
	expiresAt: Date | null;
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
	if (!(token.expiresAt && token.expiresAt.getTime() > Date.now())) {
		return null;
	}
	const now = new Date();
	return {
		session: {
			createdAt: now,
			expiresAt: token.expiresAt,
			id: `mcp-${user.id}`,
			ipAddress: null,
			token: "",
			updatedAt: now,
			userAgent: "mcp",
			userId: user.id,
		},
		user: {
			createdAt: user.createdAt,
			email: user.email,
			emailVerified: user.emailVerified,
			id: user.id,
			image: user.image ?? null,
			name: user.name,
			updatedAt: user.updatedAt,
		},
	} as McpTrpcSession;
}
