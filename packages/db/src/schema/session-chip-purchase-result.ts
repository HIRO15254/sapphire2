import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionChipPurchase } from "./session-chip-purchase";

/**
 * Per-session result: how many times each rule-defined chip purchase was
 * bought. One row per `session_chip_purchase`, so `sessionChipPurchaseId`
 * doubles as the primary key. Cost is derived on read from the linked
 * `session_chip_purchase.cost`, never duplicated here.
 */
export const sessionChipPurchaseResult = sqliteTable(
	"session_chip_purchase_result",
	{
		sessionChipPurchaseId: text("session_chip_purchase_id")
			.primaryKey()
			.references(() => sessionChipPurchase.id, { onDelete: "cascade" }),
		count: integer("count").notNull().default(0),
	}
);

export const sessionChipPurchaseResultRelations = relations(
	sessionChipPurchaseResult,
	({ one }) => ({
		chipPurchase: one(sessionChipPurchase, {
			fields: [sessionChipPurchaseResult.sessionChipPurchaseId],
			references: [sessionChipPurchase.id],
		}),
	})
);
