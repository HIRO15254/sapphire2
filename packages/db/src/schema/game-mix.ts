import { relations, sql } from "drizzle-orm";
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
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		builtinKey: text("builtin_key"),
		label: text("label").notNull(),
		games: text("games", { mode: "json" }).$type<string[]>().notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("gameMix_userId_idx").on(table.userId),
		uniqueIndex("game_mix_id_user_id_unique").on(table.id, table.userId),
		uniqueIndex("gameMix_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		uniqueIndex("gameMix_userId_label_idx").on(table.userId, table.label),
	]
);

export const gameMixVariant = sqliteTable(
	"game_mix_variant",
	{
		mixId: text("mix_id").notNull(),
		variantId: text("variant_id").notNull(),
		userId: text("user_id").notNull(),
		position: integer("position").notNull(),
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

export const gameMixRelations = relations(gameMix, ({ many, one }) => ({
	user: one(user, {
		fields: [gameMix.userId],
		references: [user.id],
	}),
	variantLinks: many(gameMixVariant),
}));

export const gameMixVariantRelations = relations(gameMixVariant, ({ one }) => ({
	mix: one(gameMix, {
		fields: [gameMixVariant.mixId, gameMixVariant.userId],
		references: [gameMix.id, gameMix.userId],
	}),
	variant: one(gameVariant, {
		fields: [gameMixVariant.variantId, gameMixVariant.userId],
		references: [gameVariant.id, gameVariant.userId],
	}),
}));
