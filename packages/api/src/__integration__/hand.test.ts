import type { Database } from "@sapphire2/db";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import {
	hand,
	handAction,
	handBoard,
	handSeat,
} from "@sapphire2/db/schema/hand";
import { player } from "@sapphire2/db/schema/player";
import { asc, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import {
	addHand,
	buildHandSaveStatements,
	deleteHand,
	getHand,
	type HandSaveInput,
	listHands,
	saveHand,
	undoLastHand,
} from "../services/hand";
import type { TestD1Database } from "./test-database";
import { test } from "./test-fixture";

type Owner = "alice" | "bob";
type Row = Record<string, string | number | null>;

const NOW = new Date("2026-09-05T10:00:00.000Z");
const FOREIGN_KEY_FAILED = "FOREIGN KEY constraint failed";

function insert(d1: TestD1Database, table: string, row: Row) {
	const columns = Object.keys(row);
	return d1
		.prepare(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
		)
		.bind(...Object.values(row))
		.run();
}

async function seedOwner(db: Database, owner: Owner) {
	await db.insert(entry).values({
		id: `${owner}-entry`,
		userId: owner,
		kind: "cash",
		source: "live",
		status: "open",
		playedOn: "2026-09-05",
		updatedAt: NOW,
	});
	await db.insert(playSession).values({
		id: `${owner}-play`,
		userId: owner,
		entryId: `${owner}-entry`,
		kind: "cash",
		seq: 1,
		localDate: "2026-09-05",
		status: "active",
		updatedAt: NOW,
	});
	await db.insert(gameGroup).values({
		id: `${owner}-group`,
		userId: owner,
		label: "Hold'em",
		updatedAt: NOW,
	});
	await db.insert(gameVariant).values({
		id: `${owner}-variant`,
		userId: owner,
		label: "NLH",
		groupId: `${owner}-group`,
		updatedAt: NOW,
	});
	await db.insert(player).values(
		Array.from({ length: 9 }, (_, index) => ({
			id: `${owner}-player-${index + 1}`,
			userId: owner,
			name: `Villain ${index + 1}`,
			updatedAt: NOW,
		}))
	);
}

function handRow(id: string, owner: Owner, overrides: Row = {}): Row {
	return {
		id,
		user_id: owner,
		play_session_id: `${owner}-play`,
		hand_no: 1,
		detail: "count",
		updated_at: 0,
		...overrides,
	};
}

function seatRow(handId: string, owner: Owner, overrides: Row = {}): Row {
	return { hand_id: handId, user_id: owner, seat: 0, ...overrides };
}

function eventRow(id: string, owner: Owner, overrides: Row = {}): Row {
	return {
		id,
		user_id: owner,
		entry_id: `${owner}-entry`,
		entry_source: "live",
		play_session_id: `${owner}-play`,
		type: "all_in",
		schema_version: 2,
		occurred_at: 0,
		sort_order: 0,
		payload: "{}",
		updated_at: 0,
		...overrides,
	};
}

function boardRow(handId: string, owner: Owner, overrides: Row = {}): Row {
	return {
		hand_id: handId,
		user_id: owner,
		board_no: 1,
		cards: "Ah Kd 7c",
		...overrides,
	};
}

function actionRow(handId: string, owner: Owner, overrides: Row = {}): Row {
	return {
		hand_id: handId,
		user_id: owner,
		seq: 1,
		street: 0,
		seat: 0,
		action: "fold",
		...overrides,
	};
}

function fullHand(
	id: string,
	seats: number,
	actions: number
): Extract<HandSaveInput, { detail: "full" }> {
	return {
		id,
		detail: "full",
		buttonSeat: 0,
		tableSize: 10,
		levelOrdinal: null,
		stakes: { blind1: 100, blind2: 200, ante: 200, anteType: "bb" },
		variantId: "alice-variant",
		boards: ["Ah Kd 7c 2s 9h", "Ah Kd 7c 3d 4c"],
		pot: 12_000,
		rake: 500,
		memo: "Long hand",
		seats: Array.from({ length: seats }, (_, seat) => ({
			seat,
			playerId: seat === 0 ? null : `alice-player-${seat}`,
			isHero: seat === 0,
			startStack: 20_000 + seat,
			holeCards: seat === 0 ? "As Ks" : null,
			net: null,
			showed: false,
		})),
		actions: Array.from({ length: actions }, (_, index) => ({
			street: Math.min(Math.floor(index / 30), 3),
			seat: index % seats,
			action: index % 3 === 0 ? "raise" : "call",
			amount: 200 * (index + 1),
			allIn: false,
		})),
	};
}

async function countHand(db: Database) {
	const added = await addHand(
		db,
		"alice",
		{ playSessionId: "alice-play" },
		NOW
	);
	return added.id;
}

async function handNumbers(db: Database, playSessionId: string) {
	const rows = await db
		.select({ id: hand.id, handNo: hand.handNo })
		.from(hand)
		.where(eq(hand.playSessionId, playSessionId))
		.orderBy(asc(hand.handNo));
	return rows.map(({ id, handNo }) => [handNo, id]);
}

async function childCounts(db: Database, handId: string) {
	const boards = await db
		.select()
		.from(handBoard)
		.where(eq(handBoard.handId, handId));
	const seats = await db
		.select()
		.from(handSeat)
		.where(eq(handSeat.handId, handId));
	const actions = await db
		.select()
		.from(handAction)
		.where(eq(handAction.handId, handId));
	return {
		boards: boards.length,
		seats: seats.length,
		actions: actions.length,
	};
}

describe("hand tables on D1", () => {
	test("hands, boards, seats and actions that point at another user's play session, hand, player or game variant are rejected while the owner's own references are stored", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		await insert(api.d1, "hand", handRow("alice-hand", "alice"));
		await insert(api.d1, "hand", handRow("bob-hand", "bob"));

		const crossOwner: [string, Row][] = [
			[
				"hand",
				handRow("bob-in-alice-play", "bob", {
					play_session_id: "alice-play",
					hand_no: 2,
				}),
			],
			[
				"hand",
				handRow("bob-alice-variant", "bob", {
					hand_no: 2,
					variant_id: "alice-variant",
				}),
			],
			["hand_board", boardRow("alice-hand", "bob")],
			["hand_seat", seatRow("alice-hand", "bob")],
			[
				"hand_seat",
				seatRow("bob-hand", "bob", { player_id: "alice-player-1" }),
			],
			["hand_action", actionRow("alice-hand", "bob")],
			[
				"play_event",
				eventRow("bob-event-alice-hand", "bob", { hand_id: "alice-hand" }),
			],
		];
		for (const [table, row] of crossOwner) {
			await expect(
				insert(api.d1, table, row),
				`${table} ${JSON.stringify(row)}`
			).rejects.toThrow(FOREIGN_KEY_FAILED);
		}

		await insert(
			api.d1,
			"hand",
			handRow("bob-second", "bob", { hand_no: 2, variant_id: "bob-variant" })
		);
		await insert(
			api.d1,
			"hand_seat",
			seatRow("bob-hand", "bob", { player_id: "bob-player-1" })
		);
		await insert(api.d1, "hand_board", boardRow("bob-hand", "bob"));
		await insert(api.d1, "hand_action", actionRow("bob-hand", "bob"));
		await insert(
			api.d1,
			"play_event",
			eventRow("bob-event", "bob", { hand_id: "bob-hand" })
		);
		expect(await handNumbers(api.db, "bob-play")).toEqual([
			[1, "bob-hand"],
			[2, "bob-second"],
		]);
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, "alice-hand"],
		]);
		expect(await childCounts(api.db, "bob-hand")).toEqual({
			boards: 1,
			seats: 1,
			actions: 1,
		});

		await expect(
			validateEntityOwnership(api.db, "hand", "alice-hand", "bob")
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this hand",
		});
		await expect(
			validateEntityOwnership(api.db, "hand", "missing-hand", "bob")
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this hand",
		});
		await expect(
			validateEntityOwnership(api.db, "hand", "bob-hand", "bob")
		).resolves.toMatchObject({ id: "bob-hand", userId: "bob" });
	});

	test("an event can point only at a hand of its own play session, and an action only at a seat dealt into its hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await api.db.insert(playSession).values({
			id: "alice-day-2",
			userId: "alice",
			entryId: "alice-entry",
			kind: "cash",
			seq: 2,
			localDate: "2026-09-06",
			status: "ended",
			endState: "cashed_out",
			updatedAt: NOW,
		});
		await insert(api.d1, "hand", handRow("day-1-hand", "alice"));
		await insert(api.d1, "hand_seat", seatRow("day-1-hand", "alice"));

		await expect(
			insert(
				api.d1,
				"play_event",
				eventRow("day-2-event", "alice", {
					play_session_id: "alice-day-2",
					hand_id: "day-1-hand",
				})
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await expect(
			insert(
				api.d1,
				"hand_action",
				actionRow("day-1-hand", "alice", { seat: 4 })
			)
		).rejects.toThrow(FOREIGN_KEY_FAILED);

		await insert(
			api.d1,
			"play_event",
			eventRow("day-1-event", "alice", { hand_id: "day-1-hand" })
		);
		await insert(api.d1, "hand_action", actionRow("day-1-hand", "alice"));
		const events = await api.db
			.select({ id: playEvent.id, handId: playEvent.handId })
			.from(playEvent);
		expect(events).toEqual([{ id: "day-1-event", handId: "day-1-hand" }]);
		expect(await childCounts(api.db, "day-1-hand")).toEqual({
			boards: 0,
			seats: 1,
			actions: 1,
		});
	});

	test("hand numbers, boards, seats, actions and the stakes snapshot outside INV-18, INV-19 and INV-23 are rejected", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await insert(api.d1, "hand", handRow("first", "alice"));
		await insert(api.d1, "hand_seat", seatRow("first", "alice", { seat: 3 }));

		await expect(
			insert(api.d1, "hand", handRow("duplicate-no", "alice"))
		).rejects.toThrow(
			"UNIQUE constraint failed: hand.play_session_id, hand.hand_no"
		);
		const rejected: [string, Row, string][] = [
			["hand", handRow("zero", "alice", { hand_no: 0 }), "hand_hand_no_check"],
			[
				"hand",
				handRow("detail", "alice", { hand_no: 2, detail: "partial" }),
				"hand_detail_check",
			],
			[
				"hand",
				handRow("button", "alice", { hand_no: 2, button_seat: 10 }),
				"hand_button_seat_check",
			],
			[
				"hand",
				handRow("stakes", "alice", { hand_no: 2, stakes: '{"bb":' }),
				"hand_stakes_json_check",
			],
			[
				"hand",
				handRow("rake", "alice", { hand_no: 2, rake: -1 }),
				"hand_rake_check",
			],
			[
				"hand_board",
				boardRow("first", "alice", { board_no: 0 }),
				"hand_board_board_no_check",
			],
			[
				"hand_board",
				boardRow("first", "alice", { board_no: 5 }),
				"hand_board_board_no_check",
			],
			[
				"hand_board",
				boardRow("first", "alice", { cards: "Ah Kd 7c 2s 9h 3d" }),
				"hand_board_cards_length_check",
			],
			[
				"hand_seat",
				seatRow("first", "alice", { seat: 10 }),
				"hand_seat_seat_check",
			],
			[
				"hand_seat",
				seatRow("first", "alice", { seat: -1 }),
				"hand_seat_seat_check",
			],
			[
				"hand_seat",
				seatRow("first", "alice", { seat: 7, showed: 1 }),
				"hand_seat_showed_cards_check",
			],
			[
				"hand_action",
				actionRow("first", "alice", { seat: 3, action: "limp" }),
				"hand_action_action_check",
			],
			[
				"hand_action",
				actionRow("first", "alice", { seat: 3, street: 8 }),
				"hand_action_street_check",
			],
		];
		for (const [table, row, constraint] of rejected) {
			await expect(
				insert(api.d1, table, row),
				`${table} ${JSON.stringify(row)}`
			).rejects.toThrow(`CHECK constraint failed: ${constraint}`);
		}

		await insert(
			api.d1,
			"hand_seat",
			seatRow("first", "alice", { seat: 5, is_hero: 1 })
		);
		await expect(
			insert(
				api.d1,
				"hand_seat",
				seatRow("first", "alice", { seat: 6, is_hero: 1 })
			)
		).rejects.toThrow("UNIQUE constraint failed: hand_seat.hand_id");
		await expect(
			insert(api.d1, "hand_action", actionRow("first", "alice", { seat: 4 }))
		).rejects.toThrow(FOREIGN_KEY_FAILED);
		await insert(
			api.d1,
			"hand_action",
			actionRow("first", "alice", { seat: 3 })
		);
		expect(await childCounts(api.db, "first")).toEqual({
			boards: 0,
			seats: 2,
			actions: 1,
		});
	});

	test("deleting the entry removes its hands, boards, seats and actions even when an all-in event links one of them", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const added = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play", buttonSeat: 2 },
			NOW
		);
		await saveHand(api.db, "alice", fullHand(added.id, 3, 4), NOW);
		const kept = await addHand(
			api.db,
			"bob",
			{ playSessionId: "bob-play" },
			NOW
		);
		await api.db.insert(playEvent).values({
			id: "alice-all-in",
			userId: "alice",
			entryId: "alice-entry",
			playSessionId: "alice-play",
			type: "all_in",
			schemaVersion: 2,
			occurredAt: NOW,
			sortOrder: 0,
			payload: "{}",
			handId: added.id,
			updatedAt: NOW,
		});

		await api.db.delete(entry).where(eq(entry.id, "alice-entry"));

		expect(await api.db.select({ id: hand.id }).from(hand)).toEqual([
			{ id: kept.id },
		]);
		expect(await childCounts(api.db, added.id)).toEqual({
			boards: 0,
			seats: 0,
			actions: 0,
		});
	});
});

describe("hand service on D1", () => {
	test("+1 numbers hands from 1 per play session, and undo removes only the latest count hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const first = await addHand(
			api.db,
			"alice",
			{
				playSessionId: "alice-play",
				buttonSeat: 3,
				stakes: { blind1: 1, blind2: 2 },
				variantId: "alice-variant",
			},
			NOW
		);
		const second = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play", buttonSeat: 4 },
			NOW
		);
		const bobs = await addHand(
			api.db,
			"bob",
			{ playSessionId: "bob-play" },
			NOW
		);
		expect(first).toMatchObject({
			handNo: 1,
			detail: "count",
			buttonSeat: 3,
			stakes: { blind1: 1, blind2: 2 },
			variantId: "alice-variant",
			playedAt: NOW,
		});
		expect(second).toMatchObject({ handNo: 2, buttonSeat: 4, stakes: null });
		expect(bobs.handNo).toBe(1);

		await expect(
			addHand(api.db, "bob", { playSessionId: "alice-play" }, NOW)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			addHand(
				api.db,
				"bob",
				{ playSessionId: "bob-play", variantId: "alice-variant" },
				NOW
			)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			undoLastHand(api.db, "bob", "alice-play")
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(await undoLastHand(api.db, "alice", "alice-play")).toEqual({
			id: second.id,
			handNo: 2,
		});
		const third = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play", buttonSeat: 5 },
			NOW
		);
		expect(third.handNo).toBe(2);
		await saveHand(api.db, "alice", fullHand(third.id, 2, 2), NOW);
		await expect(
			undoLastHand(api.db, "alice", "alice-play")
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, first.id],
			[2, third.id],
		]);

		await deleteHand(api.db, "alice", third.id);
		expect(await undoLastHand(api.db, "alice", "alice-play")).toEqual({
			id: first.id,
			handNo: 1,
		});
		expect(await undoLastHand(api.db, "alice", "alice-play")).toBeNull();
		expect(await handNumbers(api.db, "bob-play")).toEqual([[1, bobs.id]]);
	});

	test("deleting a hand closes the gap in hand numbers, and a hand linked to an all-in event is kept", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const first = await countHand(api.db);
		const second = await countHand(api.db);
		const third = await countHand(api.db);
		const fourth = await countHand(api.db);
		await saveHand(api.db, "alice", fullHand(second, 2, 3), NOW);

		await expect(deleteHand(api.db, "bob", second)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await deleteHand(api.db, "alice", second);
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, first],
			[2, third],
			[3, fourth],
		]);
		expect(await childCounts(api.db, second)).toEqual({
			boards: 0,
			seats: 0,
			actions: 0,
		});

		await api.db.insert(playEvent).values({
			id: "all-in",
			userId: "alice",
			entryId: "alice-entry",
			playSessionId: "alice-play",
			type: "all_in",
			schemaVersion: 2,
			occurredAt: NOW,
			sortOrder: 0,
			payload: "{}",
			handId: third,
			updatedAt: NOW,
		});
		await expect(deleteHand(api.db, "alice", third)).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, first],
			[2, third],
			[3, fourth],
		]);

		const next = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play" },
			NOW
		);
		expect(next.handNo).toBe(4);
	});

	test("saving a 10-seat, 120-action hand is one batch whose statements stay within the D1 bind-parameter limit", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play" },
			NOW
		);
		const input = fullHand(added.id, 10, 120);

		const statements = buildHandSaveStatements(api.db, "alice", input, NOW);
		for (const statement of statements) {
			if (!("toSQL" in statement && typeof statement.toSQL === "function")) {
				throw new Error("Expected a query builder statement");
			}
			expect(statement.toSQL().params.length).toBeLessThanOrEqual(
				D1_MAX_BOUND_PARAMS
			);
		}
		const batch = vi.spyOn(api.db, "batch");
		await saveHand(api.db, "alice", input, NOW);
		expect(batch).toHaveBeenCalledTimes(1);
		batch.mockRestore();

		const saved = await getHand(api.db, "alice", added.id);
		expect(saved).toMatchObject({
			detail: "full",
			handNo: 1,
			boards: ["Ah Kd 7c 2s 9h", "Ah Kd 7c 3d 4c"],
			stakes: { blind1: 100, blind2: 200, ante: 200, anteType: "bb" },
			rake: 500,
		});
		expect(saved.seats.map(({ seat }) => seat)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
		]);
		expect(saved.seats.filter(({ isHero }) => isHero)).toEqual([
			expect.objectContaining({ seat: 0, holeCards: "As Ks" }),
		]);
		expect(saved.actions).toHaveLength(120);
		expect(saved.actions.map(({ seq }) => seq)).toEqual(
			Array.from({ length: 120 }, (_, index) => index + 1)
		);
		expect(saved.actions.at(-1)).toEqual({
			seq: 120,
			street: 3,
			seat: 9,
			action: "call",
			amount: 24_000,
			allIn: false,
		});
	});

	test("the DB rejects a save that makes Hero sit in two seats and the hand keeps its previous details", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play" },
			NOW
		);
		await saveHand(api.db, "alice", fullHand(added.id, 3, 4), NOW);
		const twoHeroes = fullHand(added.id, 4, 6);
		twoHeroes.seats = twoHeroes.seats.map((seat) => ({
			...seat,
			isHero: seat.seat < 2,
		}));
		twoHeroes.memo = "Two heroes";

		await expect(saveHand(api.db, "alice", twoHeroes, NOW)).rejects.toThrow(
			"UNIQUE constraint failed: hand_seat.hand_id"
		);
		const kept = await getHand(api.db, "alice", added.id);
		expect(kept.memo).toBe("Long hand");
		expect(kept.seats.map(({ seat, isHero }) => [seat, isHero])).toEqual([
			[0, true],
			[1, false],
			[2, false],
		]);
		expect(kept.actions).toHaveLength(4);
	});

	test("lowering a hand's detail removes the child rows and summary values of the higher level", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const added = await addHand(
			api.db,
			"alice",
			{ playSessionId: "alice-play" },
			NOW
		);
		await saveHand(api.db, "alice", fullHand(added.id, 6, 12), NOW);

		await saveHand(
			api.db,
			"alice",
			{
				id: added.id,
				detail: "summary",
				buttonSeat: 1,
				tableSize: 6,
				levelOrdinal: null,
				stakes: null,
				variantId: null,
				boards: ["Qh Jh Th"],
				pot: 900,
				rake: null,
				memo: null,
				hero: {
					seat: 4,
					startStack: 10_000,
					holeCards: "9h 8h",
					net: -300,
					showed: true,
				},
			},
			NOW
		);
		const summary = await getHand(api.db, "alice", added.id);
		expect(summary).toMatchObject({
			detail: "summary",
			boards: ["Qh Jh Th"],
			pot: 900,
			variantId: null,
			actions: [],
		});
		expect(summary.seats).toEqual([
			{
				seat: 4,
				playerId: null,
				isHero: true,
				startStack: 10_000,
				holeCards: "9h 8h",
				net: -300,
				showed: true,
			},
		]);

		await saveHand(
			api.db,
			"alice",
			{
				id: added.id,
				detail: "count",
				buttonSeat: 2,
				tableSize: null,
				levelOrdinal: null,
				stakes: null,
				variantId: null,
			},
			NOW
		);
		expect(await getHand(api.db, "alice", added.id)).toMatchObject({
			detail: "count",
			buttonSeat: 2,
			boards: [],
			pot: null,
			rake: null,
			memo: null,
			seats: [],
			actions: [],
		});

		await expect(
			saveHand(api.db, "bob", fullHand(added.id, 2, 2), NOW)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(getHand(api.db, "bob", added.id)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const bobHand = await addHand(
			api.db,
			"bob",
			{ playSessionId: "bob-play" },
			NOW
		);
		await expect(
			saveHand(
				api.db,
				"bob",
				{ ...fullHand(bobHand.id, 2, 2), variantId: null },
				NOW
			)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await childCounts(api.db, bobHand.id)).toEqual({
			boards: 0,
			seats: 0,
			actions: 0,
		});
	});

	test("the list pages a play session's hands from the newest with a hand-number cursor and carries each page's boards and seats", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const first = await countHand(api.db);
		const second = await countHand(api.db);
		const third = await countHand(api.db);
		const fourth = await countHand(api.db);
		const fifth = await countHand(api.db);
		await addHand(api.db, "bob", { playSessionId: "bob-play" }, NOW);
		await saveHand(api.db, "alice", fullHand(fourth, 2, 1), NOW);

		const firstPage = await listHands(api.db, "alice", {
			playSessionId: "alice-play",
			limit: 2,
		});
		expect(firstPage.items.map(({ id }) => id)).toEqual([fifth, fourth]);
		expect(firstPage.items[1]?.seats.map(({ seat }) => seat)).toEqual([0, 1]);
		expect(firstPage.items[1]?.boards).toEqual([
			"Ah Kd 7c 2s 9h",
			"Ah Kd 7c 3d 4c",
		]);
		expect(firstPage.items[0]).toMatchObject({ boards: [], seats: [] });
		expect(firstPage.nextCursor).toBe(4);

		await deleteHand(api.db, "alice", fourth);
		const secondPage = await listHands(api.db, "alice", {
			playSessionId: "alice-play",
			limit: 2,
			cursor: firstPage.nextCursor,
		});
		expect(secondPage.items.map(({ id }) => id)).toEqual([third, second]);
		const lastPage = await listHands(api.db, "alice", {
			playSessionId: "alice-play",
			limit: 2,
			cursor: secondPage.nextCursor,
		});
		expect(lastPage.items.map(({ id }) => id)).toEqual([first]);
		expect(lastPage.nextCursor).toBeUndefined();

		await expect(
			listHands(api.db, "bob", { playSessionId: "alice-play", limit: 2 })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
