import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { ringGame } from "./ring-game";
import { currency, store } from "./store";

export const liveCashGameSession = sqliteTable(
	"live_cash_game_session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status").notNull(),
		storeId: text("store_id").references(() => store.id, {
			onDelete: "set null",
		}),
		ringGameId: text("ring_game_id").references(() => ringGame.id, {
			onDelete: "set null",
		}),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		heroSeatPosition: integer("hero_seat_position"),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("liveCashGameSession_userId_idx").on(table.userId),
		index("liveCashGameSession_status_idx").on(table.status),
		index("liveCashGameSession_storeId_idx").on(table.storeId),
	]
);

export const liveCashGameSessionRelations = relations(
	liveCashGameSession,
	({ one }) => ({
		user: one(user, {
			fields: [liveCashGameSession.userId],
			references: [user.id],
		}),
		store: one(store, {
			fields: [liveCashGameSession.storeId],
			references: [store.id],
		}),
		ringGame: one(ringGame, {
			fields: [liveCashGameSession.ringGameId],
			references: [ringGame.id],
		}),
		currency: one(currency, {
			fields: [liveCashGameSession.currencyId],
			references: [currency.id],
		}),
	})
);
