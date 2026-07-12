import { protectedProcedure, publicProcedure, router } from "../index";
import { aiExtractRouter } from "./ai-extract";
import { blindLevelRouter } from "./blind-level";
import { currencyRouter } from "./currency";
import { currencyTransactionRouter } from "./currency-transaction";
import { gameGroupRouter } from "./game-group";
import { gameVariantRouter } from "./game-variant";
import { liveCashGameSessionRouter } from "./live-cash-game-session";
import { liveTournamentSessionRouter } from "./live-tournament-session";
import { locationRouter } from "./location";
import { playerRouter } from "./player";
import { playerTagRouter } from "./player-tag";
import { ringGameRouter } from "./ring-game";
import { roomRouter } from "./room";
import { sessionRouter } from "./session";
import { sessionEventRouter } from "./session-event";
import { sessionTablePlayerRouter } from "./session-table-player";
import { sessionTagRouter } from "./session-tag";
import { statsRouter } from "./stats";
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
	location: locationRouter,
	room: roomRouter,
	transactionType: transactionTypeRouter,
	currency: currencyRouter,
	currencyTransaction: currencyTransactionRouter,
	gameVariant: gameVariantRouter,
	gameGroup: gameGroupRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	blindLevel: blindLevelRouter,
	tournamentChipPurchase: tournamentChipPurchaseRouter,
	session: sessionRouter,
	stats: statsRouter,
	sessionEvent: sessionEventRouter,
	sessionTag: sessionTagRouter,
	player: playerRouter,
	playerTag: playerTagRouter,
	liveCashGameSession: liveCashGameSessionRouter,
	liveTournamentSession: liveTournamentSessionRouter,
	sessionTablePlayer: sessionTablePlayerRouter,
	updateNoteView: updateNoteViewRouter,
});
export type AppRouter = typeof appRouter;
