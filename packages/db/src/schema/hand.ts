import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	cardListMaxLength,
	HAND_ACTIONS,
	HAND_DETAILS,
	MAX_BOARD_CARDS,
	MAX_HAND_BOARDS,
	MAX_HAND_STREET,
	MAX_HAND_TABLE_SIZE,
	MAX_HOLE_CARDS,
	MAX_SEAT_POSITION,
	MIN_HAND_TABLE_SIZE,
} from "../constants/hand";
import { user } from "./auth";
import { playSession } from "./entry";
import { gameVariant } from "./game-variant";
import { player } from "./player";
import { oneOf } from "./sql-checks";

const SEAT_RANGE = sql.raw(`BETWEEN 0 AND ${MAX_SEAT_POSITION}`);

export const hand = sqliteTable(
	"hand",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		playSessionId: text("play_session_id").notNull(),
		handNo: integer("hand_no").notNull(),
		seq: integer("seq").notNull().default(0),
		playedAt: integer("played_at", { mode: "timestamp" }),
		detail: text("detail", { enum: HAND_DETAILS }).notNull(),
		buttonSeat: integer("button_seat"),
		tableSize: integer("table_size"),
		levelOrdinal: integer("level_ordinal"),
		stakes: text("stakes"),
		variantId: text("variant_id"),
		pot: integer("pot"),
		rake: integer("rake"),
		memo: text("memo"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(t) => [
		uniqueIndex("hand_id_user_id_unique").on(t.id, t.userId),
		uniqueIndex("hand_id_play_session_user_unique").on(
			t.id,
			t.playSessionId,
			t.userId
		),
		uniqueIndex("hand_play_session_hand_no_unique").on(
			t.playSessionId,
			t.handNo
		),
		uniqueIndex("hand_play_session_seq_unique").on(t.playSessionId, t.seq),
		index("hand_user_played_at_idx").on(t.userId, t.playedAt),
		index("hand_variant_idx").on(t.variantId),
		foreignKey({
			columns: [t.playSessionId, t.userId],
			foreignColumns: [playSession.id, playSession.userId],
			name: "hand_play_session_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.variantId, t.userId],
			foreignColumns: [gameVariant.id, gameVariant.userId],
			name: "hand_variant_owner_fk",
		}).onDelete("no action"),
		check("hand_hand_no_check", sql`${t.handNo} >= 1`),
		check("hand_detail_check", oneOf(t.detail, HAND_DETAILS)),
		check("hand_button_seat_check", sql`${t.buttonSeat} ${SEAT_RANGE}`),
		check(
			"hand_table_size_check",
			sql`${t.tableSize} BETWEEN ${sql.raw(`${MIN_HAND_TABLE_SIZE}`)} AND ${sql.raw(`${MAX_HAND_TABLE_SIZE}`)}`
		),
		check("hand_stakes_json_check", sql`json_valid(${t.stakes})`),
		check("hand_pot_check", sql`${t.pot} >= 0`),
		check("hand_rake_check", sql`${t.rake} >= 0`),
		check("hand_level_ordinal_check", sql`${t.levelOrdinal} >= 1`),
	]
);

export const handBoard = sqliteTable(
	"hand_board",
	{
		handId: text("hand_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		boardNo: integer("board_no").notNull(),
		cards: text("cards").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.handId, t.boardNo] }),
		foreignKey({
			columns: [t.handId, t.userId],
			foreignColumns: [hand.id, hand.userId],
			name: "hand_board_hand_owner_fk",
		}).onDelete("cascade"),
		check(
			"hand_board_board_no_check",
			sql`${t.boardNo} BETWEEN 1 AND ${sql.raw(`${MAX_HAND_BOARDS}`)}`
		),
		check(
			"hand_board_cards_length_check",
			sql`length(${t.cards}) <= ${sql.raw(`${cardListMaxLength(MAX_BOARD_CARDS)}`)}`
		),
	]
);

export const handSeat = sqliteTable(
	"hand_seat",
	{
		handId: text("hand_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		seat: integer("seat").notNull(),
		playerId: text("player_id"),
		isHero: integer("is_hero", { mode: "boolean" }).notNull().default(false),
		startStack: integer("start_stack"),
		holeCards: text("hole_cards"),
		net: integer("net"),
		showed: integer("showed", { mode: "boolean" }).notNull().default(false),
	},
	(t) => [
		primaryKey({ columns: [t.handId, t.seat] }),
		uniqueIndex("hand_seat_hand_seat_user_unique").on(
			t.handId,
			t.seat,
			t.userId
		),
		uniqueIndex("hand_seat_one_hero_per_hand_idx")
			.on(t.handId)
			.where(sql`${t.isHero} = 1`),
		index("hand_seat_player_idx").on(t.playerId),
		foreignKey({
			columns: [t.handId, t.userId],
			foreignColumns: [hand.id, hand.userId],
			name: "hand_seat_hand_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.playerId, t.userId],
			foreignColumns: [player.id, player.userId],
			name: "hand_seat_player_owner_fk",
		}).onDelete("no action"),
		check("hand_seat_seat_check", sql`${t.seat} ${SEAT_RANGE}`),
		check("hand_seat_is_hero_check", sql`${t.isHero} IN (0, 1)`),
		check("hand_seat_start_stack_check", sql`${t.startStack} >= 0`),
		check(
			"hand_seat_hole_cards_length_check",
			sql`length(${t.holeCards}) <= ${sql.raw(`${cardListMaxLength(MAX_HOLE_CARDS)}`)}`
		),
		check("hand_seat_showed_check", sql`${t.showed} IN (0, 1)`),
		check(
			"hand_seat_showed_cards_check",
			sql`${t.showed} = 0 OR ${t.holeCards} IS NOT NULL`
		),
	]
);

export const handAction = sqliteTable(
	"hand_action",
	{
		handId: text("hand_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		seq: integer("seq").notNull(),
		street: integer("street").notNull(),
		seat: integer("seat").notNull(),
		action: text("action", { enum: HAND_ACTIONS }).notNull(),
		amount: integer("amount"),
		allIn: integer("all_in", { mode: "boolean" }).notNull().default(false),
	},
	(t) => [
		primaryKey({ columns: [t.handId, t.seq] }),
		foreignKey({
			columns: [t.handId, t.userId],
			foreignColumns: [hand.id, hand.userId],
			name: "hand_action_hand_owner_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.handId, t.seat, t.userId],
			foreignColumns: [handSeat.handId, handSeat.seat, handSeat.userId],
			name: "hand_action_seat_owner_fk",
		}).onDelete("cascade"),
		check("hand_action_seq_check", sql`${t.seq} >= 1`),
		check(
			"hand_action_street_check",
			sql`${t.street} BETWEEN 0 AND ${sql.raw(`${MAX_HAND_STREET}`)}`
		),
		check("hand_action_action_check", oneOf(t.action, HAND_ACTIONS)),
		check("hand_action_amount_check", sql`${t.amount} >= 0`),
		check("hand_action_all_in_check", sql`${t.allIn} IN (0, 1)`),
	]
);
