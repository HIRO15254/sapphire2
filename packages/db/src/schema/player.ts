import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { defineTagTables } from "./tag-tables";

export const player = sqliteTable(
	"player",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		memo: text("memo"),
		isTemporary: integer("is_temporary", { mode: "boolean" })
			.notNull()
			.default(false),
		isSelf: integer("is_self", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("player_id_user_id_unique").on(table.id, table.userId),
		index("player_userId_idx").on(table.userId),
		uniqueIndex("player_self_uq")
			.on(table.userId)
			.where(sql`${table.isSelf} = 1`),
		check("player_is_self_check", sql`${table.isSelf} IN (0, 1)`),
	]
);

export const { tag: playerTag, link: playerTagLink } = defineTagTables(
	"player",
	() => player,
	{
		tagColumns: { color: text("color").notNull().default("gray") },
		linkColumns: { position: integer("position").notNull().default(0) },
	}
);

export const playerToPlayerTag = sqliteTable(
	"player_to_player_tag",
	{
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		playerTagId: text("player_tag_id")
			.notNull()
			.references(() => playerTag.id, { onDelete: "cascade" }),
		position: integer("position").notNull().default(0),
	},
	(table) => [
		primaryKey({ columns: [table.playerId, table.playerTagId] }),
		index("playerToPlayerTag_playerTagId_idx").on(table.playerTagId),
	]
);

export const playerRelations = relations(player, ({ one, many }) => ({
	user: one(user, {
		fields: [player.userId],
		references: [user.id],
	}),
	tagLinks: many(playerTagLink),
}));

export const playerTagRelations = relations(playerTag, ({ one, many }) => ({
	user: one(user, {
		fields: [playerTag.userId],
		references: [user.id],
	}),
	links: many(playerTagLink),
}));

export const playerTagLinkRelations = relations(playerTagLink, ({ one }) => ({
	player: one(player, {
		fields: [playerTagLink.playerId, playerTagLink.userId],
		references: [player.id, player.userId],
	}),
	tag: one(playerTag, {
		fields: [playerTagLink.tagId, playerTagLink.userId],
		references: [playerTag.id, playerTag.userId],
	}),
}));

export const playerToPlayerTagRelations = relations(
	playerToPlayerTag,
	({ one }) => ({
		player: one(player, {
			fields: [playerToPlayerTag.playerId],
			references: [player.id],
		}),
		tag: one(playerTag, {
			fields: [playerToPlayerTag.playerTagId],
			references: [playerTag.id],
		}),
	})
);
