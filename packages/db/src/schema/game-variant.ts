import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { gameGroup } from "./game-group";

export const gameVariant = sqliteTable(
	"game_variant",
	{
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		builtinKey: text("builtin_key"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		groupId: text("group_id").notNull(),
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		shortLabel: text("short_label"),
		sortOrder: integer("sort_order").notNull().default(0),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("game_variant_id_user_id_unique").on(table.id, table.userId),
		uniqueIndex("game_variant_label_uq").on(
			table.userId,
			sql`lower(trim(${table.label}))`
		),
		uniqueIndex("game_variant_builtin_uq").on(table.userId, table.builtinKey),
		index("game_variant_group_idx").on(table.groupId),
		foreignKey({
			columns: [table.groupId, table.userId],
			foreignColumns: [gameGroup.id, gameGroup.userId],
			name: "game_variant_group_owner_fk",
		}).onDelete("no action"),
		check("game_variant_sort_order_check", sql`${table.sortOrder} >= 0`),
	]
);
