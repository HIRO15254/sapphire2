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
				data: { ...shape.data, stack: undefined },
				message: "Internal server error",
			};
		}
		return { ...shape, data: { ...shape.data, stack: undefined } };
	},
});

export const { router } = t;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			cause: "No session",
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

export const paidProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (!ctx.paidApiRateLimiter) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Paid API rate limiter is not configured",
		});
	}
	const { success } = await ctx.paidApiRateLimiter.limit({
		key: ctx.session.user.id,
	});
	if (!success) {
		throw new TRPCError({
			code: "TOO_MANY_REQUESTS",
			message: "Too many requests. Try again in a minute.",
		});
	}
	return next();
});
