import { protectedProcedure, publicProcedure, router } from "../index";
import { blindLevelRouter } from "./blind-level";
import { currencyRouter } from "./currency";
import { currencyTransactionRouter } from "./currency-transaction";
import { ringGameRouter } from "./ring-game";
import { sessionRouter } from "./session";
import { storeRouter } from "./store";
import { tournamentRouter } from "./tournament";
import { transactionTypeRouter } from "./transaction-type";

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
	transactionType: transactionTypeRouter,
	currency: currencyRouter,
	currencyTransaction: currencyTransactionRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	blindLevel: blindLevelRouter,
	session: sessionRouter,
});
export type AppRouter = typeof appRouter;
