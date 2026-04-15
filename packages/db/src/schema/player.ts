import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

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
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("player_userId_idx").on(table.userId)]
);

export const playerTag = sqliteTable(
	"player_tag",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color").notNull().default("gray"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [index("playerTag_userId_idx").on(table.userId)]
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
	(table) => [primaryKey({ columns: [table.playerId, table.playerTagId] })]
);

export const playerRelations = relations(player, ({ one, many }) => ({
	user: one(user, {
		fields: [player.userId],
		references: [user.id],
	}),
	tagLinks: many(playerToPlayerTag),
}));

export const playerTagRelations = relations(playerTag, ({ one, many }) => ({
	user: one(user, {
		fields: [playerTag.userId],
		references: [user.id],
	}),
	playerLinks: many(playerToPlayerTag),
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
