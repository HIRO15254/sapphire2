import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { gameGroup } from "./game-group";
import { gameMix } from "./game-mix";
import { gameVariant } from "./game-variant";

export const gameLineup = sqliteTable(
	"game_lineup",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		gameMixId: text("game_mix_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("game_lineup_id_user_id_unique").on(t.id, t.userId),
		index("game_lineup_game_mix_idx").on(t.gameMixId),
		foreignKey({
			columns: [t.gameMixId, t.userId],
			foreignColumns: [gameMix.id, gameMix.userId],
			name: "game_lineup_game_mix_owner_fk",
		}).onDelete("no action"),
	]
);

export const gameLineupGroup = sqliteTable(
	"game_lineup_group",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lineupId: text("lineup_id").notNull(),
		position: integer("position").notNull(),
		gameGroupId: text("game_group_id").notNull(),
		name: text("name"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(t) => [
		uniqueIndex("game_lineup_group_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("game_lineup_group_lineup_id_id_unique").on(t.lineupId, t.id),
		uniqueIndex("game_lineup_group_lineup_position_unique").on(
			t.lineupId,
			t.position
		),
		index("game_lineup_group_game_group_idx").on(t.gameGroupId),
		foreignKey({
			columns: [t.lineupId, t.userId],
			foreignColumns: [gameLineup.id, gameLineup.userId],
			name: "game_lineup_group_lineup_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.gameGroupId, t.userId],
			foreignColumns: [gameGroup.id, gameGroup.userId],
			name: "game_lineup_group_game_group_owner_fk",
		}).onDelete("no action"),
		check("game_lineup_group_position_check", sql`${t.position} >= 0`),
	]
);

export const gameLineupVariant = sqliteTable(
	"game_lineup_variant",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lineupId: text("lineup_id").notNull(),
		lineupGroupId: text("lineup_group_id").notNull(),
		variantId: text("variant_id").notNull(),
		position: integer("position").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.lineupGroupId, t.variantId] }),
		uniqueIndex("game_lineup_variant_group_position_unique").on(
			t.lineupGroupId,
			t.position
		),
		uniqueIndex("game_lineup_variant_lineup_variant_unique").on(
			t.lineupId,
			t.variantId
		),
		index("game_lineup_variant_variant_idx").on(t.variantId),
		foreignKey({
			columns: [t.lineupGroupId, t.userId],
			foreignColumns: [gameLineupGroup.id, gameLineupGroup.userId],
			name: "game_lineup_variant_group_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.lineupId, t.lineupGroupId],
			foreignColumns: [gameLineupGroup.lineupId, gameLineupGroup.id],
			name: "game_lineup_variant_group_lineup_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.variantId, t.userId],
			foreignColumns: [gameVariant.id, gameVariant.userId],
			name: "game_lineup_variant_variant_owner_fk",
		}).onDelete("no action"),
		check("game_lineup_variant_position_check", sql`${t.position} >= 0`),
	]
);
