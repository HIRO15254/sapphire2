import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";

export const sessionChipPurchaseOption = sqliteTable(
	"session_chip_purchase_option",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		cost: integer("cost").notNull(),
		chips: integer("chips").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		index("sessionChipPurchaseOption_sessionId_idx").on(table.sessionId),
		unique("sessionChipPurchaseOption_sessionId_sortOrder_uniq").on(
			table.sessionId,
			table.sortOrder
		),
	]
);

export const sessionChipPurchaseOptionRelations = relations(
	sessionChipPurchaseOption,
	({ one, many }) => ({
		session: one(gameSession, {
			fields: [sessionChipPurchaseOption.sessionId],
			references: [gameSession.id],
		}),
		records: many(sessionChipPurchaseRecord),
	})
);

export const sessionChipPurchaseRecord = sqliteTable(
	"session_chip_purchase_record",
	{
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		chipPurchaseOptionId: integer("chip_purchase_option_id")
			.notNull()
			.references(() => sessionChipPurchaseOption.id, { onDelete: "cascade" }),
		count: integer("count").notNull(),
	},
	(table) => [
		primaryKey({
			name: "sessionChipPurchaseRecord_pk",
			columns: [table.sessionId, table.chipPurchaseOptionId],
		}),
		check("sessionChipPurchaseRecord_count_nonneg", sql`${table.count} >= 0`),
	]
);

export const sessionChipPurchaseRecordRelations = relations(
	sessionChipPurchaseRecord,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionChipPurchaseRecord.sessionId],
			references: [gameSession.id],
		}),
		option: one(sessionChipPurchaseOption, {
			fields: [sessionChipPurchaseRecord.chipPurchaseOptionId],
			references: [sessionChipPurchaseOption.id],
		}),
	})
);
