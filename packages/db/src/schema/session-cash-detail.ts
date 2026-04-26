import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
