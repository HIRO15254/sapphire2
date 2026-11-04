import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	type SQLiteTableExtraConfigValue,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { LevelGameGroup } from "../schemas/game";
import { asset } from "./asset";
import { user } from "./auth";
import { room } from "./room";
import { tournamentRule } from "./rule";
import { tournamentTag } from "./tournament-tag";

export const tournament = sqliteTable(
	"tournament",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		roomId: text("room_id"),
		name: text("name").notNull(),
		memo: text("memo"),
		isFavorite: integer("is_favorite", { mode: "boolean" })
			.notNull()
			.default(false),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		defaultAssetId: text("default_asset_id"),
		currentRuleId: text("current_rule_id").notNull(),
	},
	(t): SQLiteTableExtraConfigValue[] => [
		uniqueIndex("tournament_id_user_id_unique").on(t.id, t.userId),
		index("tournament_room_idx").on(t.roomId),
		index("tournament_asset_idx").on(t.defaultAssetId),
		index("tournament_rule_idx").on(t.currentRuleId),
		foreignKey({
			columns: [t.roomId, t.userId],
			foreignColumns: [room.id, room.userId],
			name: "tournament_room_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.defaultAssetId, t.userId],
			foreignColumns: [asset.id, asset.userId],
			name: "tournament_default_asset_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.currentRuleId, t.userId],
			foreignColumns: [tournamentRule.id, tournamentRule.userId],
			name: "tournament_current_rule_owner_fk",
		}).onDelete("no action"),
		check("tournament_is_favorite_check", sql`${t.isFavorite} IN (0, 1)`),
	]
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
		games: text("games", { mode: "json" }).$type<LevelGameGroup[]>(),
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
	user: one(user, {
		fields: [tournament.userId],
		references: [user.id],
	}),
	room: one(room, {
		fields: [tournament.roomId, tournament.userId],
		references: [room.id, room.userId],
	}),
	defaultAsset: one(asset, {
		fields: [tournament.defaultAssetId, tournament.userId],
		references: [asset.id, asset.userId],
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
