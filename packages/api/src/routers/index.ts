import { protectedProcedure, publicProcedure, router } from "../index";
import { storeRouter } from "./store";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	privateData: protectedProcedure.query(({ ctx }) => {
		return {
			message: "This is private",
			user: ctx.session.user,
		};
	}),
	store: storeRouter,
});
export type AppRouter = typeof appRouter;
