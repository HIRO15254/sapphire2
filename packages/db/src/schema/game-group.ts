import { sql } from "drizzle-orm";
import {
	check,
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
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		blind1Label: text("blind1_label"),
		blind1Required: integer("blind1_required", { mode: "boolean" })
			.notNull()
			.default(false),
		blind2Label: text("blind2_label"),
		blind2Required: integer("blind2_required", { mode: "boolean" })
			.notNull()
			.default(false),
		blind3Label: text("blind3_label"),
		blind3Required: integer("blind3_required", { mode: "boolean" })
			.notNull()
			.default(false),
		builtinKey: text("builtin_key").$type<BuiltinGroupKey>(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		id: text("id").primaryKey(),
		label: text("label").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("game_group_id_user_id_unique").on(table.id, table.userId),
		index("gameGroup_userId_idx").on(table.userId),
		uniqueIndex("gameGroup_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		uniqueIndex("game_group_label_uq").on(
			table.userId,
			sql`lower(trim(${table.label}))`
		),
		check(
			"game_group_blind1_required_check",
			sql`${table.blind1Required} IN (0, 1)`
		),
		check(
			"game_group_blind2_required_check",
			sql`${table.blind2Required} IN (0, 1)`
		),
		check(
			"game_group_blind3_required_check",
			sql`${table.blind3Required} IN (0, 1)`
		),
	]
);
