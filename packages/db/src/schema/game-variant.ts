import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { gameGroup } from "./game-group";

// Per-user game-variant masters. Both the 21 built-in variants (seeded from
// DEFAULT_GAME_VARIANTS at user creation by seedDefaultGameData) AND any
// user-created variant live as rows here — code constants are seed data only,
// never a runtime fallback. `variant` columns elsewhere in the schema always
// store this row's display LABEL verbatim at write time (self-freezing), so
// deleting / editing a variant row here never touches past sessions/games.
export const gameVariant = sqliteTable(
	"game_variant",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// 'nlh' | 'plo' | ... for seeded rows, null for user-created ones.
		builtinKey: text("builtin_key"),
		label: text("label").notNull(),
		shortLabel: text("short_label"),
		groupId: text("group_id")
			.notNull()
			// A group in use by a variant cannot be deleted out from under it —
			// the game-group router's delete procedure guards with an explicit
			// count check, and this FK is the backstop (api-data-integrity.md).
			.references(() => gameGroup.id, { onDelete: "restrict" }),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [index("gameVariant_userId_idx").on(table.userId)]
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
