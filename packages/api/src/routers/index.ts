import { protectedProcedure, publicProcedure, router } from "../index";
import { aiExtractRouter } from "./ai-extract";
import { assetRouter } from "./asset";
import { assetRateRouter } from "./asset-rate";
import { blindLevelRouter } from "./blind-level";
import { currencyTransactionRouter } from "./currency-transaction";
import { filterPresetRouter } from "./filter-preset";
import { gameGroupRouter } from "./game-group";
import { gameMixRouter } from "./game-mix";
import { gameVariantRouter } from "./game-variant";
import { handRouter } from "./hand";
import { locationRouter } from "./location";
import { playerRouter } from "./player";
import { playerTagRouter } from "./player-tag";
import { ringGameRouter } from "./ring-game";
import { roomRouter } from "./room";
import { sessionTagRouter } from "./session-tag";
import { statsRouter } from "./stats";
import { tournamentRouter } from "./tournament";
import { tournamentChipPurchaseRouter } from "./tournament-chip-purchase";
import { transactionTypeRouter } from "./transaction-type";
import { updateNoteViewRouter } from "./update-note-view";
import { userSettingRouter } from "./user-setting";

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
	asset: assetRouter,
	assetRate: assetRateRouter,
	userSetting: userSettingRouter,
	currencyTransaction: currencyTransactionRouter,
	gameVariant: gameVariantRouter,
	gameGroup: gameGroupRouter,
	gameMix: gameMixRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	blindLevel: blindLevelRouter,
	tournamentChipPurchase: tournamentChipPurchaseRouter,
	stats: statsRouter,
	sessionTag: sessionTagRouter,
	hand: handRouter,
	player: playerRouter,
	playerTag: playerTagRouter,
	updateNoteView: updateNoteViewRouter,
	filterPreset: filterPresetRouter,
});
export type AppRouter = typeof appRouter;
