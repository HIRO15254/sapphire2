import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sessionChipPurchase } from "./session-chip-purchase";

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
