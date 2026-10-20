import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { asset } from "./asset";
import { user } from "./auth";
import { gameSession } from "./session";

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
	(table) => [
		index("transactionType_userId_idx").on(table.userId),
		uniqueIndex("transactionType_sessionResultPerUser_idx")
			.on(table.userId)
			.where(sql`${table.name} = 'Session Result'`),
	]
);

export const currencyTransaction = sqliteTable(
	"currency_transaction",
	{
		id: text("id").primaryKey(),
		currencyId: text("currency_id")
			.notNull()
			.references(() => asset.id, { onDelete: "cascade" }),
		transactionTypeId: text("transaction_type_id")
			.notNull()
			.references(() => transactionType.id),
		sessionId: text("session_id").references(() => gameSession.id, {
			onDelete: "cascade",
		}),
		amount: integer("amount").notNull(),
		transactedAt: integer("transacted_at", { mode: "timestamp" }).notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("currencyTransaction_currencyId_idx").on(table.currencyId),
		index("currencyTransaction_sessionId_idx").on(table.sessionId),
		index("currencyTransaction_transactionTypeId_idx").on(
			table.transactionTypeId
		),
	]
);

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
		asset: one(asset, {
			fields: [currencyTransaction.currencyId],
			references: [asset.id],
		}),
		transactionType: one(transactionType, {
			fields: [currencyTransaction.transactionTypeId],
			references: [transactionType.id],
		}),
		session: one(gameSession, {
			fields: [currencyTransaction.sessionId],
			references: [gameSession.id],
		}),
	})
);
