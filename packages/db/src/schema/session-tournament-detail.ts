import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
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
		// Snapshot fields — copied from tournament at session create time and
		// frozen thereafter. Parent rename / config change does not propagate.
		ruleName: text("rule_name").notNull().default("Untitled"),
		variant: text("variant").notNull().default("nlh"),
		startingStack: integer("starting_stack"),
		bountyAmount: integer("bounty_amount"),
		tableSize: integer("table_size"),
		// Multi-day chaining (lightweight model).
		// result: how this session concluded — 'promoted' (advanced to the next
		//   day, awaiting a link from a hasPreviousDay session) or 'finished'
		//   (normal placement / prize). NULL for in-progress or non-tournament rows.
		result: text("result"),
		// previousSessionId: the promoted prior-day session this one resumes from.
		//   Unique-indexed so a single promote is consumed by at most one next-day
		//   session. NULL = a fresh entry (incl. Day2 max-late registration).
		previousSessionId: text("previous_session_id").references(
			() => gameSession.id,
			{ onDelete: "set null" }
		),
		// bagStack: the chip count bagged at promote time, carried into the next
		//   day's starting stack.
		bagStack: integer("bag_stack"),
	},
	(t) => [
		index("session_tournament_tournament_idx").on(t.tournamentId),
		uniqueIndex("session_tournament_previous_session_unique").on(
			t.previousSessionId
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
	})
);
