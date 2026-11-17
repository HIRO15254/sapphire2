import type { createAuth } from "@sapphire2/auth";
import type { Database } from "@sapphire2/db";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	context: HonoContext;
}

type AuthInstance = ReturnType<typeof createAuth>;

export interface PaidApiRateLimiter {
	limit: (options: { key: string }) => Promise<{ success: boolean }>;
}

export function createContextFactory(
	authInstance: AuthInstance,
	dbInstance: Database,
	openaiApiKey?: string,
	googleMapsApiKey?: string,
	paidApiRateLimiter?: PaidApiRateLimiter
) {
	return async ({ context }: CreateContextOptions) => {
		const session = await authInstance.api.getSession({
			headers: context.req.raw.headers,
		});
		return {
			db: dbInstance,
			googleMapsApiKey,
			openaiApiKey,
			paidApiRateLimiter,
			session,
		};
	};
}

export type Context = Awaited<
	ReturnType<ReturnType<typeof createContextFactory>>
>;
