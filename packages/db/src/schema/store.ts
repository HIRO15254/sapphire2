import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const store = sqliteTable(
	"store",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("store_userId_idx").on(table.userId)]
);

export const currency = sqliteTable(
	"currency",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		unit: text("unit"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("currency_userId_idx").on(table.userId)]
);

export const transactionType = sqliteTable(
	"transaction_type",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("transactionType_userId_idx").on(table.userId)]
);

export const currencyTransaction = sqliteTable(
	"currency_transaction",
	{
		id: text("id").primaryKey(),
		currencyId: text("currency_id")
			.notNull()
			.references(() => currency.id, { onDelete: "cascade" }),
		transactionTypeId: text("transaction_type_id")
			.notNull()
			.references(() => transactionType.id),
		amount: integer("amount").notNull(),
		transactedAt: integer("transacted_at", { mode: "timestamp" }).notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [index("currencyTransaction_currencyId_idx").on(table.currencyId)]
);

export const storeRelations = relations(store, ({ one }) => ({
	user: one(user, {
		fields: [store.userId],
		references: [user.id],
	}),
}));

export const currencyRelations = relations(currency, ({ one, many }) => ({
	user: one(user, {
		fields: [currency.userId],
		references: [user.id],
	}),
	transactions: many(currencyTransaction),
}));

export const transactionTypeRelations = relations(
	transactionType,
	({ one, many }) => ({
		user: one(user, {
			fields: [transactionType.userId],
			references: [user.id],
		}),
		currencyTransactions: many(currencyTransaction),
	})
);

export const currencyTransactionRelations = relations(
	currencyTransaction,
	({ one }) => ({
		currency: one(currency, {
			fields: [currencyTransaction.currencyId],
			references: [currency.id],
		}),
		transactionType: one(transactionType, {
			fields: [currencyTransaction.transactionTypeId],
			references: [transactionType.id],
		}),
	})
);
