import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { player } from "./player";
import { gameSession } from "./session";

export const sessionTablePlayer = sqliteTable(
	"session_table_player",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
		seatPosition: integer("seat_position"),
		isActive: integer("is_active").notNull().default(1),
		joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
		leftAt: integer("left_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("sessionTablePlayer_sessionId_idx").on(table.sessionId),
		index("sessionTablePlayer_playerId_idx").on(table.playerId),
	]
);

export const sessionTablePlayerRelations = relations(
	sessionTablePlayer,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionTablePlayer.sessionId],
			references: [gameSession.id],
		}),
		player: one(player, {
			fields: [sessionTablePlayer.playerId],
			references: [player.id],
		}),
	})
);
