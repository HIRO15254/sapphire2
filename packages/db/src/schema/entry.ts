import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	END_STATES_REQUIRING_STACK,
	ENTRY_KINDS,
	ENTRY_SOURCES,
	ENTRY_STATUSES,
	endStatesForKind,
	PLAY_SESSION_END_STATES,
	PLAY_SESSION_STATUSES,
} from "../constants/entry";
import { user } from "./auth";
import { currency } from "./currency";
import { ringGame } from "./ring-game";
import { room } from "./room";
import { isoDate, oneOf } from "./sql-checks";
import { tournament } from "./tournament";

export const entry = sqliteTable(
	"entry",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind", { enum: ENTRY_KINDS }).notNull(),
		source: text("source", { enum: ENTRY_SOURCES }).notNull(),
		status: text("status", { enum: ENTRY_STATUSES }).notNull(),
		roomId: text("room_id"),
		assetId: text("asset_id"),
		title: text("title"),
		playedOn: text("played_on").notNull(),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("entry_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("entry_id_kind_user_id_unique").on(t.id, t.kind, t.userId),
		index("entry_user_played_on_idx").on(t.userId, t.playedOn, t.id),
		index("entry_user_kind_status_idx").on(t.userId, t.kind, t.status),
		index("entry_room_idx").on(t.roomId),
		index("entry_asset_idx").on(t.assetId),
		foreignKey({
			columns: [t.roomId, t.userId],
			foreignColumns: [room.id, room.userId],
			name: "entry_room_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.assetId, t.userId],
			foreignColumns: [currency.id, currency.userId],
			name: "entry_asset_owner_fk",
		}).onDelete("no action"),
		check("entry_kind_check", oneOf(t.kind, ENTRY_KINDS)),
		check("entry_source_check", oneOf(t.source, ENTRY_SOURCES)),
		check("entry_status_check", oneOf(t.status, ENTRY_STATUSES)),
		check(
			"entry_manual_settled_check",
			sql`${t.source} <> 'manual' OR ${t.status} = 'settled'`
		),
		check("entry_played_on_check", isoDate(t.playedOn)),
	]
);

export const entryCash = sqliteTable(
	"entry_cash",
	{
		entryId: text("entry_id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		ringGameId: text("ring_game_id"),
		evDiff: integer("ev_diff"),
	},
	(t) => [
		index("entry_cash_ring_game_idx").on(t.ringGameId),
		foreignKey({
			columns: [t.entryId, t.userId],
			foreignColumns: [entry.id, entry.userId],
			name: "entry_cash_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.ringGameId, t.userId],
			foreignColumns: [ringGame.id, ringGame.userId],
			name: "entry_cash_ring_game_owner_fk",
		}).onDelete("no action"),
	]
);

export const entryTournament = sqliteTable(
	"entry_tournament",
	{
		entryId: text("entry_id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tournamentId: text("tournament_id"),
		placement: integer("placement"),
		totalEntries: integer("total_entries"),
		beforeDeadline: integer("before_deadline", { mode: "boolean" }),
	},
	(t) => [
		index("entry_tournament_tournament_idx").on(t.tournamentId),
		foreignKey({
			columns: [t.entryId, t.userId],
			foreignColumns: [entry.id, entry.userId],
			name: "entry_tournament_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.tournamentId, t.userId],
			foreignColumns: [tournament.id, tournament.userId],
			name: "entry_tournament_tournament_owner_fk",
		}).onDelete("no action"),
		check("entry_tournament_placement_check", sql`${t.placement} >= 1`),
		check("entry_tournament_total_entries_check", sql`${t.totalEntries} >= 1`),
		check(
			"entry_tournament_placement_within_total_check",
			sql`${t.placement} <= ${t.totalEntries}`
		),
		check(
			"entry_tournament_before_deadline_check",
			sql`${t.beforeDeadline} IN (0, 1)`
		),
		check(
			"entry_tournament_before_deadline_placement_check",
			sql`${t.beforeDeadline} = 0 OR ${t.placement} IS NULL`
		),
	]
);

export const playSession = sqliteTable(
	"play_session",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		entryId: text("entry_id").notNull(),
		kind: text("kind", { enum: ENTRY_KINDS }).notNull(),
		seq: integer("seq").notNull(),
		label: text("label"),
		localDate: text("local_date").notNull(),
		startedAt: integer("started_at", { mode: "timestamp" }),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		breakMinutes: integer("break_minutes").notNull().default(0),
		status: text("status", { enum: PLAY_SESSION_STATUSES }).notNull(),
		endState: text("end_state", { enum: PLAY_SESSION_END_STATES }),
		endStack: integer("end_stack"),
		clockStartedAt: integer("clock_started_at", { mode: "timestamp" }),
		clockStartLevel: integer("clock_start_level"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("play_session_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("play_session_id_entry_id_user_id_unique").on(
			t.id,
			t.entryId,
			t.userId
		),
		uniqueIndex("play_session_entry_seq_unique").on(t.entryId, t.seq),
		uniqueIndex("play_session_one_unfinished_per_user_idx")
			.on(t.userId)
			.where(sql`${t.status} <> 'ended'`),
		index("play_session_user_local_date_idx").on(t.userId, t.localDate),
		foreignKey({
			columns: [t.entryId, t.kind, t.userId],
			foreignColumns: [entry.id, entry.kind, entry.userId],
			name: "play_session_entry_owner_fk",
		}).onDelete("cascade"),
		check("play_session_seq_check", sql`${t.seq} >= 1`),
		check("play_session_local_date_check", isoDate(t.localDate)),
		check("play_session_time_order_check", sql`${t.endedAt} >= ${t.startedAt}`),
		check("play_session_break_minutes_check", sql`${t.breakMinutes} >= 0`),
		check("play_session_status_check", oneOf(t.status, PLAY_SESSION_STATUSES)),
		check(
			"play_session_end_state_presence_check",
			sql`(${t.status} = 'ended') = (${t.endState} IS NOT NULL)`
		),
		check(
			"play_session_end_state_kind_check",
			sql`${t.endState} IS NULL OR ${sql.join(
				ENTRY_KINDS.map(
					(kind) =>
						sql`(${t.kind} = ${sql.raw(`'${kind}'`)} AND ${oneOf(
							t.endState,
							endStatesForKind(kind)
						)})`
				),
				sql` OR `
			)}`
		),
		check("play_session_end_stack_check", sql`${t.endStack} >= 0`),
		check(
			"play_session_end_stack_required_check",
			sql`${t.endStack} IS NOT NULL OR NOT (${oneOf(
				t.endState,
				END_STATES_REQUIRING_STACK
			)})`
		),
	]
);

export const playEvent = sqliteTable(
	"play_event",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		entryId: text("entry_id").notNull(),
		playSessionId: text("play_session_id").notNull(),
		type: text("type").notNull(),
		schemaVersion: integer("schema_version").notNull().default(1),
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
		sortOrder: integer("sort_order").notNull(),
		payload: text("payload").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("play_event_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("play_event_entry_sort_order_unique").on(
			t.entryId,
			t.sortOrder
		),
		index("play_event_play_session_sort_order_idx").on(
			t.playSessionId,
			t.sortOrder
		),
		foreignKey({
			columns: [t.entryId, t.userId],
			foreignColumns: [entry.id, entry.userId],
			name: "play_event_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.playSessionId, t.entryId, t.userId],
			foreignColumns: [playSession.id, playSession.entryId, playSession.userId],
			name: "play_event_play_session_owner_fk",
		}).onDelete("cascade"),
		check("play_event_payload_json_check", sql`json_valid(${t.payload})`),
	]
);

export const entryRelations = relations(entry, ({ one, many }) => ({
	user: one(user, {
		fields: [entry.userId],
		references: [user.id],
	}),
	room: one(room, {
		fields: [entry.roomId, entry.userId],
		references: [room.id, room.userId],
	}),
	asset: one(currency, {
		fields: [entry.assetId, entry.userId],
		references: [currency.id, currency.userId],
	}),
	cash: one(entryCash),
	tournament: one(entryTournament),
	playSessions: many(playSession),
	playEvents: many(playEvent),
}));

export const entryCashRelations = relations(entryCash, ({ one }) => ({
	entry: one(entry, {
		fields: [entryCash.entryId, entryCash.userId],
		references: [entry.id, entry.userId],
	}),
	ringGame: one(ringGame, {
		fields: [entryCash.ringGameId, entryCash.userId],
		references: [ringGame.id, ringGame.userId],
	}),
}));

export const entryTournamentRelations = relations(
	entryTournament,
	({ one }) => ({
		entry: one(entry, {
			fields: [entryTournament.entryId, entryTournament.userId],
			references: [entry.id, entry.userId],
		}),
		tournament: one(tournament, {
			fields: [entryTournament.tournamentId, entryTournament.userId],
			references: [tournament.id, tournament.userId],
		}),
	})
);

export const playSessionRelations = relations(playSession, ({ one, many }) => ({
	entry: one(entry, {
		fields: [playSession.entryId, playSession.userId],
		references: [entry.id, entry.userId],
	}),
	playEvents: many(playEvent),
}));

export const playEventRelations = relations(playEvent, ({ one }) => ({
	entry: one(entry, {
		fields: [playEvent.entryId, playEvent.userId],
		references: [entry.id, entry.userId],
	}),
	playSession: one(playSession, {
		fields: [playEvent.playSessionId, playEvent.userId],
		references: [playSession.id, playSession.userId],
	}),
}));
