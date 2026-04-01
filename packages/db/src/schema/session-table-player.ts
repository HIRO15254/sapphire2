import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { liveCashGameSession } from "./live-cash-game-session";
import { liveTournamentSession } from "./live-tournament-session";
import { player } from "./player";

export const sessionTablePlayer = sqliteTable(
	"session_table_player",
	{
		id: text("id").primaryKey(),
		liveCashGameSessionId: text("live_cash_game_session_id").references(
			() => liveCashGameSession.id,
			{ onDelete: "cascade" }
		),
		liveTournamentSessionId: text("live_tournament_session_id").references(
			() => liveTournamentSession.id,
			{ onDelete: "cascade" }
		),
		playerId: text("player_id")
			.notNull()
			.references(() => player.id, { onDelete: "cascade" }),
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
		index("sessionTablePlayer_liveCashGameSessionId_idx").on(
			table.liveCashGameSessionId
		),
		index("sessionTablePlayer_liveTournamentSessionId_idx").on(
			table.liveTournamentSessionId
		),
		index("sessionTablePlayer_playerId_idx").on(table.playerId),
	]
);

export const sessionTablePlayerRelations = relations(
	sessionTablePlayer,
	({ one }) => ({
		liveCashGameSession: one(liveCashGameSession, {
			fields: [sessionTablePlayer.liveCashGameSessionId],
			references: [liveCashGameSession.id],
		}),
		liveTournamentSession: one(liveTournamentSession, {
			fields: [sessionTablePlayer.liveTournamentSessionId],
			references: [liveTournamentSession.id],
		}),
		player: one(player, {
			fields: [sessionTablePlayer.playerId],
			references: [player.id],
		}),
	})
);
