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

// Per-user game-group masters. Both the 3 built-in groups (bigbet/limit/stud,
// seeded from DEFAULT_GAME_GROUPS at user creation by seedDefaultGameData)
// AND any user-created group live as rows here — code constants are seed data
// only, never a runtime fallback. `variant` columns elsewhere in the schema
// always store the display label verbatim (self-freezing), so deleting /
// editing a group row here never touches past sessions/games.
export const gameGroup = sqliteTable(
	"game_group",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// 'bigbet' | 'limit' | 'stud' for seeded rows, null for user-created ones.
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
		// SQLite treats NULLs as distinct, so this never constrains
		// user-created rows (builtinKey null) against each other — only guards
		// the 3 seeded builtin rows per user against a concurrent double-seed
		// duplicating them (c08).
		uniqueIndex("gameGroup_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		// Exact-case backstop for the app-level case-insensitive label check
		// (c14) — guards against a TOCTOU race between that check and the
		// insert/update, not a replacement for it.
		uniqueIndex("gameGroup_userId_label_idx").on(table.userId, table.label),
	]
);

export const gameGroupRelations = relations(gameGroup, ({ one }) => ({
	user: one(user, {
		fields: [gameGroup.userId],
		references: [user.id],
	}),
}));
