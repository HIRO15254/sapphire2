import type { createAuth } from "@sapphire2/auth";
import type { Database } from "@sapphire2/db";
import type { Context as HonoContext } from "hono";

export interface CreateContextOptions {
	context: HonoContext;
}

type AuthInstance = ReturnType<typeof createAuth>;

export function createContextFactory(
	authInstance: AuthInstance,
	dbInstance: Database,
	openaiApiKey?: string,
	googleMapsApiKey?: string
) {
	return async ({ context }: CreateContextOptions) => {
		const session = await authInstance.api.getSession({
			headers: context.req.raw.headers,
		});
		return { session, db: dbInstance, openaiApiKey, googleMapsApiKey };
	};
}

export type Context = Awaited<
	ReturnType<ReturnType<typeof createContextFactory>>
>;
