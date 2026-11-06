import { sql } from "drizzle-orm";
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
import { asset } from "./asset";
import { user } from "./auth";
import { hand } from "./hand";
import { ringGame } from "./ring-game";
import { room } from "./room";
import { cashRule, tournamentRule } from "./rule";
import { isoDate, oneOf } from "./sql-checks";
import { tournament } from "./tournament";

export const entry = sqliteTable(
	"entry",
	{
		assetId: text("asset_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: ENTRY_KINDS }).notNull(),
		memo: text("memo"),
		playedOn: text("played_on").notNull(),
		roomId: text("room_id"),
		source: text("source", { enum: ENTRY_SOURCES }).notNull(),
		status: text("status", { enum: ENTRY_STATUSES }).notNull(),
		title: text("title"),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("entry_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("entry_id_kind_user_id_unique").on(t.id, t.kind, t.userId),
		uniqueIndex("entry_id_source_user_id_unique").on(t.id, t.source, t.userId),
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
			foreignColumns: [asset.id, asset.userId],
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
		cashRuleId: text("cash_rule_id").notNull(),
		entryId: text("entry_id").primaryKey(),
		evDiff: integer("ev_diff"),
		kind: text("kind", { enum: ["cash"] })
			.notNull()
			.$default(() => "cash"),
		ringGameId: text("ring_game_id"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		index("entry_cash_ring_game_idx").on(t.ringGameId),
		index("entry_cash_cash_rule_idx").on(t.cashRuleId),
		foreignKey({
			columns: [t.entryId, t.kind, t.userId],
			foreignColumns: [entry.id, entry.kind, entry.userId],
			name: "entry_cash_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.ringGameId, t.userId],
			foreignColumns: [ringGame.id, ringGame.userId],
			name: "entry_cash_ring_game_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.cashRuleId, t.userId],
			foreignColumns: [cashRule.id, cashRule.userId],
			name: "entry_cash_cash_rule_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.cashRuleId, t.ringGameId],
			foreignColumns: [cashRule.id, cashRule.ringGameId],
			name: "entry_cash_cash_rule_master_fk",
		}).onDelete("no action"),
		check("entry_cash_kind_check", sql`${t.kind} = 'cash'`),
	]
);

export const entryTournament = sqliteTable(
	"entry_tournament",
	{
		beforeDeadline: integer("before_deadline", { mode: "boolean" })
			.notNull()
			.default(false),
		entryId: text("entry_id").primaryKey(),
		kind: text("kind", { enum: ["tournament"] })
			.notNull()
			.$default(() => "tournament"),
		placement: integer("placement"),
		totalEntries: integer("total_entries"),
		tournamentId: text("tournament_id"),
		tournamentRuleId: text("tournament_rule_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		index("entry_tournament_tournament_idx").on(t.tournamentId),
		index("entry_tournament_tournament_rule_idx").on(t.tournamentRuleId),
		foreignKey({
			columns: [t.entryId, t.kind, t.userId],
			foreignColumns: [entry.id, entry.kind, entry.userId],
			name: "entry_tournament_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.tournamentId, t.userId],
			foreignColumns: [tournament.id, tournament.userId],
			name: "entry_tournament_tournament_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.tournamentRuleId, t.userId],
			foreignColumns: [tournamentRule.id, tournamentRule.userId],
			name: "entry_tournament_tournament_rule_owner_fk",
		}).onDelete("no action"),
		foreignKey({
			columns: [t.tournamentRuleId, t.tournamentId],
			foreignColumns: [tournamentRule.id, tournamentRule.tournamentId],
			name: "entry_tournament_tournament_rule_master_fk",
		}).onDelete("no action"),
		check("entry_tournament_kind_check", sql`${t.kind} = 'tournament'`),
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
		breakMinutes: integer("break_minutes").notNull().default(0),
		clockStartedAt: integer("clock_started_at", { mode: "timestamp" }),
		clockStartLevel: integer("clock_start_level"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		endedAt: integer("ended_at", { mode: "timestamp" }),
		endStack: integer("end_stack"),
		endState: text("end_state", { enum: PLAY_SESSION_END_STATES }),
		entryId: text("entry_id").notNull(),
		id: text("id").primaryKey(),
		kind: text("kind", { enum: ENTRY_KINDS }).notNull(),
		label: text("label"),
		localDate: text("local_date").notNull(),
		nextHandSeq: integer("next_hand_seq").notNull().default(0),
		seq: integer("seq").notNull(),
		startedAt: integer("started_at", { mode: "timestamp" }),
		status: text("status", { enum: PLAY_SESSION_STATUSES }).notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
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
		check(
			"play_session_clock_start_level_check",
			sql`${t.clockStartLevel} >= 1`
		),
	]
);

export const playEvent = sqliteTable(
	"play_event",
	{
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		entryId: text("entry_id").notNull(),
		entrySource: text("entry_source", { enum: ["live"] })
			.notNull()
			.$default(() => "live"),
		handId: text("hand_id"),
		id: text("id").primaryKey(),
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
		payload: text("payload").notNull(),
		playSessionId: text("play_session_id").notNull(),
		schemaVersion: integer("schema_version").notNull(),
		sortOrder: integer("sort_order").notNull(),
		type: text("type").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("play_event_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("play_event_id_entry_play_session_user_unique").on(
			t.id,
			t.entryId,
			t.playSessionId,
			t.userId
		),
		uniqueIndex("play_event_entry_sort_order_unique").on(
			t.entryId,
			t.sortOrder
		),
		index("play_event_play_session_sort_order_idx").on(
			t.playSessionId,
			t.sortOrder
		),
		index("play_event_hand_idx").on(t.handId),
		index("play_event_user_player_ref_idx").on(
			t.userId,
			sql`json_extract(${t.payload}, '$.playerId')`
		),
		foreignKey({
			columns: [t.entryId, t.entrySource, t.userId],
			foreignColumns: [entry.id, entry.source, entry.userId],
			name: "play_event_entry_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.playSessionId, t.entryId, t.userId],
			foreignColumns: [playSession.id, playSession.entryId, playSession.userId],
			name: "play_event_play_session_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.handId, t.playSessionId, t.userId],
			foreignColumns: [hand.id, hand.playSessionId, hand.userId],
			name: "play_event_hand_owner_fk",
		}).onDelete("no action"),
		check("play_event_entry_source_check", sql`${t.entrySource} = 'live'`),
		check("play_event_schema_version_check", sql`${t.schemaVersion} >= 1`),
		check("play_event_payload_json_check", sql`json_valid(${t.payload})`),
		check("play_event_sort_order_check", sql`${t.sortOrder} >= 0`),
	]
);
