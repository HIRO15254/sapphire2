import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { ringGameBlindSet } from "./ring-game-blind-set";
import { currency, store } from "./store";
import { variant } from "./variant";

export const ringGame = sqliteTable(
	"ring_game",
	{
		id: text("id").primaryKey(),
		storeId: text("store_id").references(() => store.id, {
			onDelete: "cascade",
		}),
		name: text("name").notNull(),
		variantId: integer("variant_id").references(() => variant.id, {
			onDelete: "set null",
		}),
		minBuyIn: integer("min_buy_in"),
		maxBuyIn: integer("max_buy_in"),
		tableSize: integer("table_size"),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		memo: text("memo"),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("ringGame_storeId_idx").on(table.storeId)]
);

export const ringGameRelations = relations(ringGame, ({ one, many }) => ({
	store: one(store, {
		fields: [ringGame.storeId],
		references: [store.id],
	}),
	currency: one(currency, {
		fields: [ringGame.currencyId],
		references: [currency.id],
	}),
	variantRef: one(variant, {
		fields: [ringGame.variantId],
		references: [variant.id],
	}),
	blindSets: many(ringGameBlindSet),
}));
