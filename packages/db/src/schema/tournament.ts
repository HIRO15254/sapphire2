import { sql } from "drizzle-orm";
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
import { asset } from "./asset";
import { user } from "./auth";
import { room } from "./room";
import { tournamentRule } from "./rule";

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
