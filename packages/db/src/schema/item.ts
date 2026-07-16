import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { currency } from "./currency";
import { gameSession } from "./session";

// Non-currency asset master (tournament tickets, vouchers, ...). Each item
// carries a currency-equivalent value per unit so item-based buy-ins /
// cash-outs can flow into virtual P/L without touching currency balances.
export const item = sqliteTable(
	"item",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// The currency the item's value is denominated in. No onDelete cascade:
		// currency deletion is guarded in the currency router while items
		// reference it (same class of hazard as SA2-165).
		currencyId: text("currency_id")
			.notNull()
			.references(() => currency.id),
		// Currency-equivalent value of one item, in the currency's minor units.
		unitValue: integer("unit_value").notNull(),
		description: text("description"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("item_userId_idx").on(table.userId),
		index("item_currencyId_idx").on(table.currencyId),
	]
);

// Item holdings ledger — holdings = Σ count per item. Rows are either manual
// (sessionId null) or session-generated (sessionId set, one row per
// session+item enforced by the partial unique index, mirroring the
// currency_transaction "Session Result" upsert pattern).
export const itemTransaction = sqliteTable(
	"item_transaction",
	{
		id: text("id").primaryKey(),
		itemId: text("item_id")
			.notNull()
			.references(() => item.id, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => gameSession.id, {
			onDelete: "cascade",
		}),
		// Signed count: positive = items gained (cash-out), negative = items
		// spent (buy-in). Zero rows are never written.
		count: integer("count").notNull(),
		transactedAt: integer("transacted_at", { mode: "timestamp" }).notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("itemTransaction_itemId_idx").on(table.itemId),
		index("itemTransaction_sessionId_idx").on(table.sessionId),
		uniqueIndex("itemTransaction_session_item_idx")
			.on(table.sessionId, table.itemId)
			.where(sql`${table.sessionId} is not null`),
	]
);

export const itemRelations = relations(item, ({ one, many }) => ({
	user: one(user, {
		fields: [item.userId],
		references: [user.id],
	}),
	currency: one(currency, {
		fields: [item.currencyId],
		references: [currency.id],
	}),
	transactions: many(itemTransaction),
}));

export const itemTransactionRelations = relations(
	itemTransaction,
	({ one }) => ({
		item: one(item, {
			fields: [itemTransaction.itemId],
			references: [item.id],
		}),
		session: one(gameSession, {
			fields: [itemTransaction.sessionId],
			references: [gameSession.id],
		}),
	})
);
