import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";
import { tournament } from "./tournament";
import { variant } from "./variant";

export const sessionTournamentDetail = sqliteTable(
	"session_tournament_detail",
	{
		sessionId: text("session_id")
			.primaryKey()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		tournamentId: text("tournament_id").references(() => tournament.id, {
			onDelete: "set null",
		}),
		// rule snapshot columns
		ruleName: text("rule_name").notNull(),
		startingStack: integer("starting_stack"),
		bountyAmount: integer("bounty_amount"),
		tableSize: integer("table_size"),
		buyIn: integer("buy_in").notNull(),
		entryFee: integer("entry_fee").notNull().default(0),
		// variant is linked directly (not snapshotted), ON DELETE RESTRICT
		variantId: integer("variant_id")
			.notNull()
			.references(() => variant.id, { onDelete: "restrict" }),
		// result columns (live: projection from events; manual: user input)
		placement: integer("placement"),
		totalEntries: integer("total_entries"),
		beforeDeadline: integer("before_deadline", { mode: "boolean" }),
		prizeMoney: integer("prize_money"),
		bountyPrizes: integer("bounty_prizes"),
		// canonical timer start (removed from session_start event payload)
		timerStartedAt: integer("timer_started_at", { mode: "timestamp" }),
	},
	(t) => [
		index("session_tournament_tournament_idx").on(t.tournamentId),
		// before_deadline=1 → placement IS NULL AND total_entries IS NULL
		check(
			"session_tournament_before_deadline_check",
			sql`(before_deadline != 1) OR (placement IS NULL AND total_entries IS NULL)`
		),
	]
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
		variant: one(variant, {
			fields: [sessionTournamentDetail.variantId],
			references: [variant.id],
		}),
	})
);
