import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import type { MixGameGroup } from "../schemas/game";
import { ringGame } from "./ring-game";
import { gameSession } from "./session";

export const sessionCashDetail = sqliteTable(
	"session_cash_detail",
	{
		sessionId: text("session_id")
			.primaryKey()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		ringGameId: text("ring_game_id").references(() => ringGame.id, {
			onDelete: "set null",
		}),
		buyIn: integer("buy_in"),
		cashOut: integer("cash_out"),
		evCashOut: integer("ev_cash_out"),
		// Σ of chips racked off the table across every negative chips_add_remove
		// event (early cash-out). Persisted separately from cashOut so completed-
		// session P/L (list/detail/stats) can add it back in, matching the live
		// session's own `cashOut + chipRemoveTotal - buyIn` formula.
		chipRemoveTotal: integer("chip_remove_total"),
		// Snapshot fields — copied from ring_game at session create time and
		// frozen thereafter. Parent rename / blind change does not propagate.
		ruleName: text("rule_name").notNull().default("Untitled"),
		variant: text("variant").notNull().default(DEFAULT_VARIANT_LABEL),
		mixGames: text("mix_games", { mode: "json" }).$type<MixGameGroup[]>(),
		blind1: integer("blind1"),
		blind2: integer("blind2"),
		blind3: integer("blind3"),
		ante: integer("ante"),
		anteType: text("ante_type"),
		minBuyIn: integer("min_buy_in"),
		maxBuyIn: integer("max_buy_in"),
		tableSize: integer("table_size"),
	},
	(t) => [index("session_cash_ring_idx").on(t.ringGameId)]
);

export const sessionCashDetailRelations = relations(
	sessionCashDetail,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionCashDetail.sessionId],
			references: [gameSession.id],
		}),
		ringGame: one(ringGame, {
			fields: [sessionCashDetail.ringGameId],
			references: [ringGame.id],
		}),
	})
);
