import { sql } from "drizzle-orm";
import {
	check,
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
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		id: text("id").primaryKey(),
		isDefault: integer("is_default", { mode: "boolean" })
			.notNull()
			.default(false),
		name: text("name").notNull(),
		payload: text("payload", { mode: "json" })
			.$type<FilterPresetPayload>()
			.notNull(),
		screenKey: text("screen_key").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		check("filterPreset_payload_json_check", sql`json_valid(${table.payload})`),
		index("filterPreset_userId_idx").on(table.userId),
		index("filterPreset_userId_screenKey_idx").on(
			table.userId,
			table.screenKey
		),
		uniqueIndex("filterPreset_userId_screenKey_name_idx").on(
			table.userId,
			table.screenKey,
			sql`${table.name} COLLATE NOCASE`
		),
		uniqueIndex("filterPreset_userId_screenKey_defaultUnique_idx")
			.on(table.userId, table.screenKey)
			.where(sql`${table.isDefault} = 1`),
	]
);
