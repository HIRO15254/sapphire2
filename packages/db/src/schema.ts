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
	dashboardWidget,
	dashboardWidgetRelations,
} from "./schema/dashboard-widget";
import { limitFormat, limitFormatRelations } from "./schema/limit-format";
import {
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
} from "./schema/player";
import { ringGame, ringGameRelations } from "./schema/ring-game";
import {
	ringGameBlindSet,
	ringGameBlindSetRelations,
} from "./schema/ring-game-blind-set";
import { gameSession, gameSessionRelations } from "./schema/session";
import {
	sessionBlindLevel,
	sessionBlindLevelRelations,
} from "./schema/session-blind-level";
import {
	sessionCashBlindSet,
	sessionCashBlindSetRelations,
} from "./schema/session-cash-blind-set";
import {
	sessionCashDetail,
	sessionCashDetailRelations,
} from "./schema/session-cash-detail";
import {
	sessionChipPurchaseOption,
	sessionChipPurchaseOptionRelations,
	sessionChipPurchaseRecord,
	sessionChipPurchaseRecordRelations,
} from "./schema/session-chip-purchase-option";
import { sessionEvent, sessionEventRelations } from "./schema/session-event";
import {
	sessionTag,
	sessionTagRelations,
	sessionToSessionTag,
	sessionToSessionTagRelations,
} from "./schema/session-tag";
import {
	sessionTournamentBlindSet,
	sessionTournamentBlindSetRelations,
} from "./schema/session-tournament-blind-set";
import {
	sessionTournamentDetail,
	sessionTournamentDetailRelations,
} from "./schema/session-tournament-detail";
import {
	currency,
	currencyRelations,
	currencyTransaction,
	currencyTransactionRelations,
	store,
	storeRelations,
	transactionType,
	transactionTypeRelations,
} from "./schema/store";
import {
	tournament,
	tournamentChipPurchase,
	tournamentChipPurchaseRelations,
	tournamentRelations,
} from "./schema/tournament";
import {
	tournamentBlindLevel,
	tournamentBlindLevelRelations,
} from "./schema/tournament-blind-level";
import {
	tournamentBlindSet,
	tournamentBlindSetRelations,
} from "./schema/tournament-blind-set";
import { tournamentTag, tournamentTagRelations } from "./schema/tournament-tag";
import {
	updateNoteView,
	updateNoteViewRelations,
} from "./schema/update-note-view";
import { variant, variantRelations } from "./schema/variant";

export const schema = {
	// auth
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
	// master: shared
	store,
	storeRelations,
	currency,
	currencyRelations,
	transactionType,
	transactionTypeRelations,
	currencyTransaction,
	currencyTransactionRelations,
	limitFormat,
	limitFormatRelations,
	variant,
	variantRelations,
	// master: cash game
	ringGame,
	ringGameRelations,
	ringGameBlindSet,
	ringGameBlindSetRelations,
	// master: tournament
	tournament,
	tournamentRelations,
	tournamentBlindLevel,
	tournamentBlindLevelRelations,
	tournamentBlindSet,
	tournamentBlindSetRelations,
	tournamentChipPurchase,
	tournamentChipPurchaseRelations,
	tournamentTag,
	tournamentTagRelations,
	// session
	gameSession,
	gameSessionRelations,
	sessionCashDetail,
	sessionCashDetailRelations,
	sessionTournamentDetail,
	sessionTournamentDetailRelations,
	sessionBlindLevel,
	sessionBlindLevelRelations,
	sessionTournamentBlindSet,
	sessionTournamentBlindSetRelations,
	sessionCashBlindSet,
	sessionCashBlindSetRelations,
	sessionChipPurchaseOption,
	sessionChipPurchaseOptionRelations,
	sessionChipPurchaseRecord,
	sessionChipPurchaseRecordRelations,
	sessionEvent,
	sessionEventRelations,
	// session tags
	sessionTag,
	sessionTagRelations,
	sessionToSessionTag,
	sessionToSessionTagRelations,
	// other
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
	updateNoteView,
	updateNoteViewRelations,
	dashboardWidget,
	dashboardWidgetRelations,
};
