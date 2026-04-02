import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { currency, store } from "./store";
import { tournament } from "./tournament";

export const liveTournamentSession = sqliteTable(
	"live_tournament_session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status").notNull(),
		storeId: text("store_id").references(() => store.id, {
			onDelete: "set null",
		}),
		tournamentId: text("tournament_id").references(() => tournament.id, {
			onDelete: "set null",
		}),
		currencyId: text("currency_id").references(() => currency.id, {
			onDelete: "set null",
		}),
		buyIn: integer("buy_in"),
		entryFee: integer("entry_fee"),
		startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		heroSeatPosition: integer("hero_seat_position"),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("liveTournamentSession_userId_idx").on(table.userId),
		index("liveTournamentSession_status_idx").on(table.status),
		index("liveTournamentSession_storeId_idx").on(table.storeId),
	]
);

export const liveTournamentSessionRelations = relations(
	liveTournamentSession,
	({ one }) => ({
		user: one(user, {
			fields: [liveTournamentSession.userId],
			references: [user.id],
		}),
		store: one(store, {
			fields: [liveTournamentSession.storeId],
			references: [store.id],
		}),
		tournament: one(tournament, {
			fields: [liveTournamentSession.tournamentId],
			references: [tournament.id],
		}),
		currency: one(currency, {
			fields: [liveTournamentSession.currencyId],
			references: [currency.id],
		}),
	})
);
