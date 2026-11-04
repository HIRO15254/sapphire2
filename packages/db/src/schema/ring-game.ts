import { relations, sql } from "drizzle-orm";
import {
	foreignKey,
	index,
	integer,
	type SQLiteTableExtraConfigValue,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { asset } from "./asset";
import { user } from "./auth";
import { room } from "./room";
import { cashRule } from "./rule";

export const ringGame = sqliteTable(
	"ring_game",
	{
		id: text("id").primaryKey(),
		roomId: text("room_id"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		memo: text("memo"),
		defaultAssetId: text("default_asset_id"),
		currentRuleId: text("current_rule_id").notNull(),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table): SQLiteTableExtraConfigValue[] => [
		uniqueIndex("ring_game_id_user_id_unique").on(table.id, table.userId),
		index("ring_game_room_idx").on(table.roomId),
		index("ring_game_user_idx").on(table.userId),
		index("ring_game_asset_idx").on(table.defaultAssetId),
		index("ring_game_rule_idx").on(table.currentRuleId),
		foreignKey({
			columns: [table.roomId, table.userId],
			foreignColumns: [room.id, room.userId],
			name: "ring_game_room_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.defaultAssetId, table.userId],
			foreignColumns: [asset.id, asset.userId],
			name: "ring_game_default_asset_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [table.currentRuleId, table.userId],
			foreignColumns: [cashRule.id, cashRule.userId],
			name: "ring_game_current_rule_owner_fk",
		}).onDelete("no action"),
	]
);

export const ringGameRelations = relations(ringGame, ({ one }) => ({
	room: one(room, {
		fields: [ringGame.roomId],
		references: [room.id],
	}),
	user: one(user, {
		fields: [ringGame.userId],
		references: [user.id],
	}),
	defaultAsset: one(asset, {
		fields: [ringGame.defaultAssetId],
		references: [asset.id],
	}),
}));
