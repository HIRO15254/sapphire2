import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
		timerStartedAt: integer("timer_started_at", { mode: "timestamp" }),
		// Snapshot fields — copied from tournament at session create time.
		// Blind / rule changes on the parent stay frozen (SA2-95), but
		// `ruleName` is cascade-updated by tournament.update /
		// updateWithLevels whenever the parent is still linked, so a rename
		// does propagate.
		ruleName: text("rule_name").notNull().default("Untitled"),
		variant: text("variant").notNull().default("nlh"),
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
