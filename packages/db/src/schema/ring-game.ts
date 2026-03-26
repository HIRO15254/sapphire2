import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { currency, store } from "./store";

export const ringGame = sqliteTable(
	"ring_game",
	{
		id: text("id").primaryKey(),
		storeId: text("store_id")
			.notNull()
			.references(() => store.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		variant: text("variant").notNull().default("nlh"),
		blind1: integer("blind1"),
		blind2: integer("blind2"),
		blind3: integer("blind3"),
		ante: integer("ante"),
		anteType: text("ante_type"),
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
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("ringGame_storeId_idx").on(table.storeId)]
);

export const ringGameRelations = relations(ringGame, ({ one }) => ({
	store: one(store, {
		fields: [ringGame.storeId],
		references: [store.id],
	}),
	currency: one(currency, {
		fields: [ringGame.currencyId],
		references: [currency.id],
	}),
}));
