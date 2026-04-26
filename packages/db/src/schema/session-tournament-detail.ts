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
		rebuyCount: integer("rebuy_count"),
		rebuyCost: integer("rebuy_cost"),
		addonCost: integer("addon_cost"),
		bountyPrizes: integer("bounty_prizes"),
		timerStartedAt: integer("timer_started_at", { mode: "timestamp" }),
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
