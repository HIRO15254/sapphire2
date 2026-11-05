import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		if (
			error.code === "INTERNAL_SERVER_ERROR" &&
			error.cause !== undefined &&
			!(error.cause instanceof TRPCError)
		) {
			return {
				...shape,
				message: "Internal server error",
				data: { ...shape.data, stack: undefined },
			};
		}
		return { ...shape, data: { ...shape.data, stack: undefined } };
	},
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});
