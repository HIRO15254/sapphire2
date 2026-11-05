import { publicProcedure, router } from "../index";
import { aiExtractRouter } from "./ai-extract";
import { assetRouter } from "./asset";
import { assetRateRouter } from "./asset-rate";
import { entryRouter } from "./entry";
import { entryTagRouter } from "./entry-tag";
import { filterPresetRouter } from "./filter-preset";
import { gameGroupRouter } from "./game-group";
import { gameMixRouter } from "./game-mix";
import { gameVariantRouter } from "./game-variant";
import { handRouter } from "./hand";
import { ledgerRouter } from "./ledger";
import { ledgerCategoryRouter } from "./ledger-category";
import { locationRouter } from "./location";
import { playerRouter } from "./player";
import { playerTagRouter } from "./player-tag";
import { ringGameRouter } from "./ring-game";
import { roomRouter } from "./room";
import { statsRouter } from "./stats";
import { tournamentRouter } from "./tournament";
import { updateNoteViewRouter } from "./update-note-view";
import { userSettingRouter } from "./user-setting";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	entry: entryRouter,
	entryTag: entryTagRouter,
	aiExtract: aiExtractRouter,
	location: locationRouter,
	room: roomRouter,
	asset: assetRouter,
	assetRate: assetRateRouter,
	userSetting: userSettingRouter,
	ledger: ledgerRouter,
	ledgerCategory: ledgerCategoryRouter,
	gameVariant: gameVariantRouter,
	gameGroup: gameGroupRouter,
	gameMix: gameMixRouter,
	ringGame: ringGameRouter,
	tournament: tournamentRouter,
	stats: statsRouter,
	hand: handRouter,
	player: playerRouter,
	playerTag: playerTagRouter,
	updateNoteView: updateNoteViewRouter,
	filterPreset: filterPresetRouter,
});
export type AppRouter = typeof appRouter;
