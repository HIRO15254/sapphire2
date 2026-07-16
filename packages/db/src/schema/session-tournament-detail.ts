import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { gameSession } from "./session";
import { tournament } from "./tournament";

export const sessionTournamentDetail = sqliteTable(
	"session_tournament_detail",
	{
		sessionId: text("session_id")
			.primaryKey()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		tournamentId: text("tournament_id").references(() => tournament.id, {
			onDelete: "set null",
		}),
		tournamentBuyIn: integer("tournament_buy_in"),
		entryFee: integer("entry_fee"),
		placement: integer("placement"),
		totalEntries: integer("total_entries"),
		beforeDeadline: integer("before_deadline", { mode: "boolean" }),
		prizeMoney: integer("prize_money"),
		bountyPrizes: integer("bounty_prizes"),
		// Pure-virtual amounts (no item), in the session currency. Item-based
		// virtual value lives in session_item_usage (count × unitValue) and is
		// intentionally NOT double-booked here. Never feeds currency balances.
		virtualBuyIn: integer("virtual_buy_in"),
		virtualCashOut: integer("virtual_cash_out"),
		timerStartedAt: integer("timer_started_at", { mode: "timestamp" }),
		// Snapshot fields — copied from tournament at session create time and
		// frozen thereafter. Parent rename / config change does not propagate.
		ruleName: text("rule_name").notNull().default("Untitled"),
		variant: text("variant").notNull().default(DEFAULT_VARIANT_LABEL),
		startingStack: integer("starting_stack"),
		bountyAmount: integer("bounty_amount"),
		tableSize: integer("table_size"),
	},
	(t) => [index("session_tournament_tournament_idx").on(t.tournamentId)]
);

export const sessionTournamentDetailRelations = relations(
	sessionTournamentDetail,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionTournamentDetail.sessionId],
			references: [gameSession.id],
		}),
		tournament: one(tournament, {
			fields: [sessionTournamentDetail.tournamentId],
			references: [tournament.id],
		}),
	})
);
