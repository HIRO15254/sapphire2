import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { item } from "./item";
import { gameSession } from "./session";

// Canonical per-session record of item-based virtual buy-ins / cash-outs.
// For live sessions these rows are rewritten from virtual_buy_in /
// virtual_cash_out events on every recalculation; for manual sessions they
// come straight from the create/update input. Stats aggregation, the item
// ledger sync, and session detail display all read from here.
export const sessionItemUsage = sqliteTable(
	"session_item_usage",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		// set null on item deletion — the snapshot columns below keep the row
		// displayable; the ledger sync simply skips rows without an itemId.
		itemId: text("item_id").references(() => item.id, {
			onDelete: "set null",
		}),
		// 'buy_in' | 'cash_out' (enforced in app code / Zod, not a DB enum,
		// matching game_session.kind / source).
		direction: text("direction").notNull(),
		count: integer("count").notNull(),
		// Snapshot fields — frozen at usage time. Editing an item's value never
		// rewrites history; only an explicit manual-session edit re-snapshots.
		itemName: text("item_name").notNull(),
		unitValue: integer("unit_value").notNull(),
		currencyId: text("currency_id"),
	},
	(t) => [
		index("sessionItemUsage_sessionId_idx").on(t.sessionId),
		index("sessionItemUsage_itemId_idx").on(t.itemId),
	]
);

export const sessionItemUsageRelations = relations(
	sessionItemUsage,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionItemUsage.sessionId],
			references: [gameSession.id],
		}),
		item: one(item, {
			fields: [sessionItemUsage.itemId],
			references: [item.id],
		}),
	})
);
