import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import type { MixGameGroup } from "../schemas/game";
import { user } from "./auth";
import { currency } from "./currency";
import { room } from "./room";

export const ringGame = sqliteTable(
	"ring_game",
	{
		id: text("id").primaryKey(),
		roomId: text("room_id").references(() => room.id, {
			onDelete: "cascade",
		}),
		// Real ownership anchor (SA2-181). Nullable at the DB level so the ADD
		// COLUMN migration is safe on populated tables; the app sets it on every
		// insert and ownership treats null as not-owned. This closes the IDOR gap
		// for auto-generated snapshot rows whose roomId is null and therefore had
		// no ownership anchor under the room-derived model.
		userId: text("user_id").references(() => user.id, {
			onDelete: "cascade",
		}),
		name: text("name").notNull(),
		variant: text("variant").notNull().default(DEFAULT_VARIANT_LABEL),
		// Mix-game definition: named groups of games sharing one blind
		// structure (validated by mixGamesSchema in ../schemas/game). NULL for
		// non-mix games.
		mixGames: text("mix_games", { mode: "json" }).$type<MixGameGroup[]>(),
		blind1: integer("blind1"),
		blind2: integer("blind2"),
		blind3: integer("blind3"),
		ante: integer("ante"),
		anteType: text("ante_type"),
		minBuyIn: integer("min_buy_in"),
		maxBuyIn: integer("max_buy_in"),
		tableSize: integer("table_size"),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		memo: text("memo"),
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("ringGame_roomId_idx").on(table.roomId),
		index("ringGame_userId_idx").on(table.userId),
		index("ringGame_currencyId_idx").on(table.currencyId),
	]
);

export const ringGameRelations = relations(ringGame, ({ one }) => ({
	room: one(room, {
		fields: [ringGame.roomId],
		references: [room.id],
	}),
	user: one(user, {
		fields: [ringGame.userId],
		references: [user.id],
	}),
	currency: one(currency, {
		fields: [ringGame.currencyId],
		references: [currency.id],
	}),
}));
