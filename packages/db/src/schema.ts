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
import {
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
} from "./schema/player";
import { ringGame, ringGameRelations } from "./schema/ring-game";
import { gameSession, gameSessionRelations } from "./schema/session";
import {
	sessionCashDetail,
	sessionCashDetailRelations,
} from "./schema/session-cash-detail";
import { sessionEvent, sessionEventRelations } from "./schema/session-event";
import {
	sessionTablePlayer,
	sessionTablePlayerRelations,
} from "./schema/session-table-player";
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
	store,
	storeRelations,
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
	sessionTablePlayer,
	sessionTablePlayerRelations,
	sessionCashDetail,
	sessionCashDetailRelations,
	sessionTournamentDetail,
	sessionTournamentDetailRelations,
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
