import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { ringGame } from "./ring-game";
import { gameSession } from "./session";
import { variant } from "./variant";

export const sessionCashDetail = sqliteTable(
	"session_cash_detail",
	{
		sessionId: text("session_id")
			.primaryKey()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		ringGameId: text("ring_game_id").references(() => ringGame.id, {
			onDelete: "set null",
		}),
		// rule snapshot columns
		ruleName: text("rule_name").notNull(),
		minBuyIn: integer("min_buy_in"),
		maxBuyIn: integer("max_buy_in"),
		tableSize: integer("table_size"),
		// variant is linked directly (not snapshotted), ON DELETE RESTRICT
		variantId: integer("variant_id")
			.notNull()
			.references(() => variant.id, { onDelete: "restrict" }),
		// result columns (live: projection from events; manual: user input)
		buyIn: integer("buy_in"),
		cashOut: integer("cash_out"),
		evCashOut: integer("ev_cash_out"),
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
		variant: one(variant, {
			fields: [sessionCashDetail.variantId],
			references: [variant.id],
		}),
	})
);
