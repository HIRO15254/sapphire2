import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";

export const sessionChipPurchase = sqliteTable(
	"session_chip_purchase",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		cost: integer("cost").notNull(),
		chips: integer("chips").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(t) => [index("session_chip_purchase_session_idx").on(t.sessionId)]
);

export const sessionChipPurchaseRelations = relations(
	sessionChipPurchase,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionChipPurchase.sessionId],
			references: [gameSession.id],
		}),
	})
);
