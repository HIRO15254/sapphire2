import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { BuiltinGroupKey } from "../constants/game-variants";
import { user } from "./auth";

export const gameGroup = sqliteTable(
	"game_group",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		builtinKey: text("builtin_key").$type<BuiltinGroupKey>(),
		label: text("label").notNull(),
		blind1Label: text("blind1_label"),
		blind2Label: text("blind2_label"),
		blind3Label: text("blind3_label"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("gameGroup_userId_idx").on(table.userId),
		uniqueIndex("gameGroup_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		uniqueIndex("gameGroup_userId_label_idx").on(table.userId, table.label),
	]
);

export const gameGroupRelations = relations(gameGroup, ({ one }) => ({
	user: one(user, {
		fields: [gameGroup.userId],
		references: [user.id],
	}),
}));
