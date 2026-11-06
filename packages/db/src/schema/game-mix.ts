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
import { gameVariant } from "./game-variant";

export const gameMix = sqliteTable(
	"game_mix",
	{
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		builtinKey: text("builtin_key"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		index("gameMix_userId_idx").on(table.userId),
		uniqueIndex("game_mix_id_user_id_unique").on(table.id, table.userId),
		uniqueIndex("gameMix_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		uniqueIndex("game_mix_label_uq").on(
			table.userId,
			sql`lower(trim(${table.label}))`
		),
	]
);

export const gameMixVariant = sqliteTable(
	"game_mix_variant",
	{
		mixId: text("mix_id").notNull(),
		position: integer("position").notNull(),
		userId: text("user_id").notNull(),
		variantId: text("variant_id").notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.mixId, table.variantId] }),
		uniqueIndex("game_mix_variant_mix_position_unique").on(
			table.mixId,
			table.position
		),
		check("game_mix_variant_position_nonnegative", sql`${table.position} >= 0`),
		index("game_mix_variant_user_mix_position_idx").on(
			table.userId,
			table.mixId,
			table.position
		),
		index("game_mix_variant_variant_user_idx").on(
			table.variantId,
			table.userId
		),
		foreignKey({
			columns: [table.mixId, table.userId],
			foreignColumns: [gameMix.id, gameMix.userId],
			name: "game_mix_variant_mix_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.variantId, table.userId],
			foreignColumns: [gameVariant.id, gameVariant.userId],
			name: "game_mix_variant_variant_owner_fk",
		}).onDelete("no action"),
	]
);
