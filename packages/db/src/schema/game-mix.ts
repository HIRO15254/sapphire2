import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

// Per-user named-mix masters. A mix is a reusable mixed-game DEFINITION —
// label + ordered game composition — not a session/game record itself. Both
// the 3 built-in mixes (HORSE/8-Game/10-Game, seeded from DEFAULT_GAME_MIXES
// at user creation by seedDefaultGameData) AND any user-created mix live as
// rows here. `games` references gameVariant rows BY ID (not label) so a
// variant rename propagates into every mix that includes it; the `variant`
// string stored elsewhere (ring_game.variant, session snapshots, etc.) is
// this row's display LABEL verbatim at write time (self-freezing), so
// deleting / editing a mix row here never touches past sessions/games.
export const gameMix = sqliteTable(
	"game_mix",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// 'horse' | '8game' | '10game' for seeded rows, null for user-created ones.
		builtinKey: text("builtin_key"),
		label: text("label").notNull(),
		// Ordered game_variant ids. No amounts stored — a mix is a composition
		// only; blinds/antes live on the session/game as usual.
		games: text("games", { mode: "json" }).$type<string[]>().notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("gameMix_userId_idx").on(table.userId),
		// SQLite treats NULLs as distinct, so this never constrains
		// user-created rows (builtinKey null) against each other — only guards
		// the 3 seeded builtin rows per user against a concurrent double-seed
		// duplicating them (c08).
		uniqueIndex("gameMix_userId_builtinKey_idx").on(
			table.userId,
			table.builtinKey
		),
		// Exact-case backstop for the app-level case-insensitive label check
		// (c14) — guards against a TOCTOU race between that check and the
		// insert/update, not a replacement for it.
		uniqueIndex("gameMix_userId_label_idx").on(table.userId, table.label),
	]
);

export const gameMixRelations = relations(gameMix, ({ one }) => ({
	user: one(user, {
		fields: [gameMix.userId],
		references: [user.id],
	}),
}));
