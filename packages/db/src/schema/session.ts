import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { liveCashGameSession } from "./live-cash-game-session";
import { liveTournamentSession } from "./live-tournament-session";
import { ringGame } from "./ring-game";
import { sessionToSessionTag } from "./session-tag";
import { currency, currencyTransaction, store } from "./store";
import { tournament } from "./tournament";

export const pokerSession = sqliteTable(
	"poker_session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		sessionDate: integer("session_date", { mode: "timestamp" }).notNull(),
		storeId: text("store_id").references(() => store.id, {
			onDelete: "set null",
		}),
		ringGameId: text("ring_game_id").references(() => ringGame.id, {
			onDelete: "set null",
		}),
		tournamentId: text("tournament_id").references(() => tournament.id, {
			onDelete: "set null",
		}),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		liveCashGameSessionId: text("live_cash_game_session_id").references(
			() => liveCashGameSession.id,
			{ onDelete: "set null" }
		),
		liveTournamentSessionId: text("live_tournament_session_id").references(
			() => liveTournamentSession.id,
			{ onDelete: "set null" }
		),
		buyIn: integer("buy_in"),
		cashOut: integer("cash_out"),
		evCashOut: integer("ev_cash_out"),
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
		startedAt: integer("started_at", { mode: "timestamp" }),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		breakMinutes: integer("break_minutes"),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("pokerSession_userId_idx").on(table.userId),
		index("pokerSession_sessionDate_idx").on(table.sessionDate),
		index("pokerSession_storeId_idx").on(table.storeId),
		index("pokerSession_currencyId_idx").on(table.currencyId),
	]
);

export const pokerSessionRelations = relations(
	pokerSession,
	({ one, many }) => ({
		user: one(user, {
			fields: [pokerSession.userId],
			references: [user.id],
		}),
		store: one(store, {
			fields: [pokerSession.storeId],
			references: [store.id],
		}),
		ringGame: one(ringGame, {
			fields: [pokerSession.ringGameId],
			references: [ringGame.id],
		}),
		tournament: one(tournament, {
			fields: [pokerSession.tournamentId],
			references: [tournament.id],
		}),
		currency: one(currency, {
			fields: [pokerSession.currencyId],
			references: [currency.id],
		}),
		liveCashGameSession: one(liveCashGameSession, {
			fields: [pokerSession.liveCashGameSessionId],
			references: [liveCashGameSession.id],
		}),
		liveTournamentSession: one(liveTournamentSession, {
			fields: [pokerSession.liveTournamentSessionId],
			references: [liveTournamentSession.id],
		}),
		transactions: many(currencyTransaction),
		tagLinks: many(sessionToSessionTag),
	})
);
