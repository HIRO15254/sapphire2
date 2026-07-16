import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { FilterPresetPayload } from "../schemas/filter-preset";
import { user } from "./auth";

export const filterPreset = sqliteTable(
	"filter_preset",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		screenKey: text("screen_key").notNull(),
		name: text("name").notNull(),
		payload: text("payload", { mode: "json" })
			.$type<FilterPresetPayload>()
			.notNull(),
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("filterPreset_userId_idx").on(table.userId),
		index("filterPreset_userId_screenKey_idx").on(
			table.userId,
			table.screenKey
		),
		uniqueIndex("filterPreset_userId_screenKey_name_idx").on(
			table.userId,
			table.screenKey,
			table.name
		),
		uniqueIndex("filterPreset_userId_screenKey_defaultUnique_idx")
			.on(table.userId, table.screenKey)
			.where(sql`${table.isDefault} = 1`),
	]
);

export const filterPresetRelations = relations(filterPreset, ({ one }) => ({
	user: one(user, {
		fields: [filterPreset.userId],
		references: [user.id],
	}),
}));
