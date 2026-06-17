import { relations, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { currency } from "./currency";
import { room } from "./room";
import { tournamentTag } from "./tournament-tag";

export const tournament = sqliteTable(
	"tournament",
	{
		id: text("id").primaryKey(),
		roomId: text("room_id")
			.notNull()
			.references(() => room.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		variant: text("variant").notNull().default("nlh"),
		buyIn: integer("buy_in"),
		entryFee: integer("entry_fee"),
		startingStack: integer("starting_stack"),
		bountyAmount: integer("bounty_amount"),
		tableSize: integer("table_size"),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		memo: text("memo"),
		// Multi-day chaining (lightweight model): each Day is one tournament rule.
		// These flags + the optional self-link describe how a rule connects to the
		// previous / next day; the actual per-session linkage lives on
		// session_tournament_detail.previousSessionId.
		hasNextDay: integer("has_next_day", { mode: "boolean" })
			.notNull()
			.default(false),
		hasPreviousDay: integer("has_previous_day", { mode: "boolean" })
			.notNull()
			.default(false),
		nextDayTournamentId: text("next_day_tournament_id").references(
			(): AnySQLiteColumn => tournament.id,
			{ onDelete: "set null" }
		),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("tournament_roomId_idx").on(table.roomId)]
);

export const blindLevel = sqliteTable(
	"blind_level",
	{
		id: text("id").primaryKey(),
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournament.id, { onDelete: "cascade" }),
		level: integer("level").notNull(),
		isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
		blind1: integer("blind1"),
		blind2: integer("blind2"),
		blind3: integer("blind3"),
		ante: integer("ante"),
		minutes: integer("minutes"),
	},
	(table) => [index("blindLevel_tournamentId_idx").on(table.tournamentId)]
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
	room: one(room, {
		fields: [tournament.roomId],
		references: [room.id],
	}),
	currency: one(currency, {
		fields: [tournament.currencyId],
		references: [currency.id],
	}),
	blindLevels: many(blindLevel),
	chipPurchases: many(tournamentChipPurchase),
	tags: many(tournamentTag),
}));

export const blindLevelRelations = relations(blindLevel, ({ one }) => ({
	tournament: one(tournament, {
		fields: [blindLevel.tournamentId],
		references: [tournament.id],
	}),
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
