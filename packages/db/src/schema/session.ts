import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { sessionToSessionTag } from "./session-tag";
import { currency, currencyTransaction, store } from "./store";

export const gameSession = sqliteTable(
	"game_session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		status: text("status").notNull(),
		source: text("source").notNull(),
		sessionDate: integer("session_date", { mode: "timestamp" }).notNull(),
		startedAt: integer("started_at", { mode: "timestamp" }),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		breakMinutes: integer("break_minutes"),
		memo: text("memo"),
		storeId: text("store_id").references(() => store.id, {
			onDelete: "set null",
		}),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(t) => [
		index("session_user_kind_status_idx").on(t.userId, t.kind, t.status),
		index("session_user_date_idx").on(t.userId, t.sessionDate),
		index("session_store_idx").on(t.storeId),
		index("session_currency_idx").on(t.currencyId),
		check(
			"session_manual_completed_check",
			sql`(source != 'manual') OR (status = 'completed')`
		),
	]
);

export const gameSessionRelations = relations(gameSession, ({ one, many }) => ({
	user: one(user, {
		fields: [gameSession.userId],
		references: [user.id],
	}),
	store: one(store, {
		fields: [gameSession.storeId],
		references: [store.id],
	}),
	currency: one(currency, {
		fields: [gameSession.currencyId],
		references: [currency.id],
	}),
	transactions: many(currencyTransaction),
	tagLinks: many(sessionToSessionTag),
}));
