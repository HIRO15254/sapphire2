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
	ringGame,
	ringGameRelations,
	tournament,
	tournamentRelations,
	blindLevel,
	blindLevelRelations,
};
