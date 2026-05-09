import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { currency, store } from "./store";
import { tournamentTag } from "./tournament-tag";
import { variant } from "./variant";

export const tournament = sqliteTable(
	"tournament",
	{
		id: text("id").primaryKey(),
		storeId: text("store_id")
			.notNull()
			.references(() => store.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		// informational FK (SET NULL) — variant name shown in master; sessions link directly
		variantId: integer("variant_id").references(() => variant.id, {
			onDelete: "set null",
		}),
		buyIn: integer("buy_in"),
		entryFee: integer("entry_fee"),
		startingStack: integer("starting_stack"),
		bountyAmount: integer("bounty_amount"),
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
	(table) => [index("tournament_storeId_idx").on(table.storeId)]
);

export const tournamentChipPurchase = sqliteTable(
	"tournament_chip_purchase",
	{
		id: text("id").primaryKey(),
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournament.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		cost: integer("cost").notNull(),
		chips: integer("chips").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		index("tournamentChipPurchase_tournamentId_idx").on(table.tournamentId),
	]
);

export const tournamentRelations = relations(tournament, ({ one, many }) => ({
	store: one(store, {
		fields: [tournament.storeId],
		references: [store.id],
	}),
	currency: one(currency, {
		fields: [tournament.currencyId],
		references: [currency.id],
	}),
	variantRef: one(variant, {
		fields: [tournament.variantId],
		references: [variant.id],
	}),
	chipPurchases: many(tournamentChipPurchase),
	tags: many(tournamentTag),
}));

export const tournamentChipPurchaseRelations = relations(
	tournamentChipPurchase,
	({ one }) => ({
		tournament: one(tournament, {
			fields: [tournamentChipPurchase.tournamentId],
			references: [tournament.id],
		}),
	})
);
