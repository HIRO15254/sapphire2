import { relations, sql } from "drizzle-orm";
import {
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
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		builtinKey: text("builtin_key"),
		label: text("label").notNull(),
		shortLabel: text("short_label"),
		groupId: text("group_id")
			.notNull()
			.references(() => gameGroup.id, { onDelete: "restrict" }),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("gameVariant_userId_idx").on(table.userId),
		index("gameVariant_groupId_idx").on(table.groupId),
		uniqueIndex("game_variant_id_user_id_unique").on(table.id, table.userId),
		uniqueIndex("gameVariant_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		uniqueIndex("gameVariant_userId_label_idx").on(table.userId, table.label),
	]
);

export const gameVariantRelations = relations(gameVariant, ({ one }) => ({
	user: one(user, {
		fields: [gameVariant.userId],
		references: [user.id],
	}),
	group: one(gameGroup, {
		fields: [gameVariant.groupId],
		references: [gameGroup.id],
	}),
}));
