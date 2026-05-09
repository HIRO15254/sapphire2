import { protectedProcedure, publicProcedure, router } from "../index";
import { aiExtractRouter } from "./ai-extract";
import { currencyRouter } from "./currency";
import { currencyTransactionRouter } from "./currency-transaction";
import { dashboardWidgetRouter } from "./dashboard-widget";
import { limitFormatRouter } from "./limit-format";
import { liveSessionRouter } from "./live-session";
import { playerRouter } from "./player";
import { playerTagRouter } from "./player-tag";
import { ringGameRouter } from "./ring-game";
import { sessionRouter } from "./session";
import { sessionEventRouter } from "./session-event";
import { sessionTagRouter } from "./session-tag";
import { storeRouter } from "./store";
import { tournamentRouter } from "./tournament";
import { tournamentChipPurchaseRouter } from "./tournament-chip-purchase";
import { transactionTypeRouter } from "./transaction-type";
import { updateNoteViewRouter } from "./update-note-view";
import { variantRouter } from "./variant";

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
	aiExtract: aiExtractRouter,
	store: storeRouter,
	transactionType: transactionTypeRouter,
	currency: currencyRouter,
	currencyTransaction: currencyTransactionRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	tournamentChipPurchase: tournamentChipPurchaseRouter,
	session: sessionRouter,
	sessionEvent: sessionEventRouter,
	sessionTag: sessionTagRouter,
	player: playerRouter,
	playerTag: playerTagRouter,
	liveSession: liveSessionRouter,
	limitFormat: limitFormatRouter,
	variant: variantRouter,
	updateNoteView: updateNoteViewRouter,
	dashboardWidget: dashboardWidgetRouter,
});
export type AppRouter = typeof appRouter;
