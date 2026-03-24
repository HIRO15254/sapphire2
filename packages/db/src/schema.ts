import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "./schema/auth";
import { ringGame, ringGameRelations } from "./schema/ring-game";
import { pokerSession, pokerSessionRelations } from "./schema/session";
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
	tournamentTag,
	tournamentTagRelations,
	sessionTag,
	sessionTagRelations,
	sessionToSessionTag,
	sessionToSessionTagRelations,
};
