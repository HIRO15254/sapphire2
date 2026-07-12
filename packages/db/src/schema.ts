import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./schema/auth";
import {
	currency,
	currencyRelations,
	currencyTransaction,
	currencyTransactionRelations,
	transactionType,
	transactionTypeRelations,
} from "./schema/currency";
import { gameGroup, gameGroupRelations } from "./schema/game-group";
import { gameVariant, gameVariantRelations } from "./schema/game-variant";
import {
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
} from "./schema/player";
import { ringGame, ringGameRelations } from "./schema/ring-game";
import { room, roomRelations } from "./schema/room";
import { gameSession, gameSessionRelations } from "./schema/session";
import {
	sessionBlindLevel,
	sessionBlindLevelRelations,
} from "./schema/session-blind-level";
import {
	sessionCashDetail,
	sessionCashDetailRelations,
} from "./schema/session-cash-detail";
import {
	sessionChipPurchase,
	sessionChipPurchaseRelations,
} from "./schema/session-chip-purchase";
import {
	sessionChipPurchaseResult,
	sessionChipPurchaseResultRelations,
} from "./schema/session-chip-purchase-result";
import { sessionEvent, sessionEventRelations } from "./schema/session-event";
import {
	sessionTag,
	sessionTagRelations,
	sessionToSessionTag,
	sessionToSessionTagRelations,
} from "./schema/session-tag";
import {
	sessionTournamentDetail,
	sessionTournamentDetailRelations,
} from "./schema/session-tournament-detail";
import {
	blindLevel,
	blindLevelRelations,
	tournament,
	tournamentChipPurchase,
	tournamentChipPurchaseRelations,
	tournamentRelations,
} from "./schema/tournament";
import { tournamentTag, tournamentTagRelations } from "./schema/tournament-tag";
import {
	updateNoteView,
	updateNoteViewRelations,
} from "./schema/update-note-view";

export const schema = {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
	room,
	roomRelations,
	currency,
	currencyRelations,
	transactionType,
	transactionTypeRelations,
	currencyTransaction,
	currencyTransactionRelations,
	gameSession,
	gameSessionRelations,
	ringGame,
	ringGameRelations,
	tournament,
	tournamentRelations,
	blindLevel,
	blindLevelRelations,
	tournamentChipPurchase,
	tournamentChipPurchaseRelations,
	tournamentTag,
	tournamentTagRelations,
	sessionTag,
	sessionTagRelations,
	sessionToSessionTag,
	sessionToSessionTagRelations,
	sessionEvent,
	sessionEventRelations,
	sessionCashDetail,
	sessionCashDetailRelations,
	sessionTournamentDetail,
	sessionTournamentDetailRelations,
	sessionBlindLevel,
	sessionBlindLevelRelations,
	sessionChipPurchase,
	sessionChipPurchaseRelations,
	sessionChipPurchaseResult,
	sessionChipPurchaseResultRelations,
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
	updateNoteView,
	updateNoteViewRelations,
	gameGroup,
	gameGroupRelations,
	gameVariant,
	gameVariantRelations,
};
