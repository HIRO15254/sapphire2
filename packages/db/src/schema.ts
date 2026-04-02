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
	liveCashGameSession,
	liveCashGameSessionRelations,
} from "./schema/live-cash-game-session";
import {
	liveTournamentSession,
	liveTournamentSessionRelations,
} from "./schema/live-tournament-session";
import {
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
} from "./schema/player";
import { ringGame, ringGameRelations } from "./schema/ring-game";
import { pokerSession, pokerSessionRelations } from "./schema/session";
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
	pokerSession,
	pokerSessionRelations,
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
	liveCashGameSession,
	liveCashGameSessionRelations,
	liveTournamentSession,
	liveTournamentSessionRelations,
	sessionEvent,
	sessionEventRelations,
	sessionTablePlayer,
	sessionTablePlayerRelations,
	player,
	playerRelations,
	playerTag,
	playerTagRelations,
	playerToPlayerTag,
	playerToPlayerTagRelations,
};
