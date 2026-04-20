import { protectedProcedure, publicProcedure, router } from "../index";
import { aiExtractRouter } from "./ai-extract";
import { aiExtractPlayersRouter } from "./ai-extract-players";
import { blindLevelRouter } from "./blind-level";
import { currencyRouter } from "./currency";
import { currencyTransactionRouter } from "./currency-transaction";
import { dashboardWidgetRouter } from "./dashboard-widget";
import { liveCashGameSessionRouter } from "./live-cash-game-session";
import { liveTournamentSessionRouter } from "./live-tournament-session";
import { playerRouter } from "./player";
import { playerTagRouter } from "./player-tag";
import { ringGameRouter } from "./ring-game";
import { sessionRouter } from "./session";
import { sessionEventRouter } from "./session-event";
import { sessionTablePlayerRouter } from "./session-table-player";
import { sessionTagRouter } from "./session-tag";
import { storeRouter } from "./store";
import { tournamentRouter } from "./tournament";
import { tournamentChipPurchaseRouter } from "./tournament-chip-purchase";
import { transactionTypeRouter } from "./transaction-type";
import { updateNoteViewRouter } from "./update-note-view";

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
	aiExtractPlayers: aiExtractPlayersRouter,
	store: storeRouter,
	transactionType: transactionTypeRouter,
	currency: currencyRouter,
	currencyTransaction: currencyTransactionRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	blindLevel: blindLevelRouter,
	tournamentChipPurchase: tournamentChipPurchaseRouter,
	session: sessionRouter,
	sessionEvent: sessionEventRouter,
	sessionTag: sessionTagRouter,
	player: playerRouter,
	playerTag: playerTagRouter,
	liveCashGameSession: liveCashGameSessionRouter,
	liveTournamentSession: liveTournamentSessionRouter,
	sessionTablePlayer: sessionTablePlayerRouter,
	updateNoteView: updateNoteViewRouter,
	dashboardWidget: dashboardWidgetRouter,
});
export type AppRouter = typeof appRouter;
