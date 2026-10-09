import type { Database } from "@sapphire2/db";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { hand, handAction, handSeat } from "@sapphire2/db/schema/hand";
import { player } from "@sapphire2/db/schema/player";
import { asc, eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";
import { validateEntityOwnership } from "../routers/session";
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
		stakes: { sb: 100, bb: 200, ante: 200 },
		variantId: "alice-variant",
		board: "Ah Kd 7c 2s 9h",
		pot: 12_000,
		heroNet: 6400,
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
	const seats = await db
		.select()
		.from(handSeat)
		.where(eq(handSeat.handId, handId));
	const actions = await db
		.select()
		.from(handAction)
		.where(eq(handAction.handId, handId));
	return { seats: seats.length, actions: actions.length };
}

describe("hand tables on D1", () => {
	test("hands, seats and actions that point at another user's play session, hand, player or game variant are rejected while the owner's own references are stored", async ({
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
			["hand_seat", seatRow("alice-hand", "bob")],
			[
				"hand_seat",
				seatRow("bob-hand", "bob", { player_id: "alice-player-1" }),
			],
			["hand_action", actionRow("alice-hand", "bob")],
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
		await insert(api.d1, "hand_action", actionRow("bob-hand", "bob"));
		expect(await handNumbers(api.db, "bob-play")).toEqual([
			[1, "bob-hand"],
			[2, "bob-second"],
		]);
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, "alice-hand"],
		]);
		expect(await childCounts(api.db, "bob-hand")).toEqual({
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

	test("hand numbers, seats, actions and the stakes snapshot outside INV-18, INV-19 and INV-23 are rejected", async ({
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
				handRow("board", "alice", {
					hand_no: 2,
					board: "Ah Kd 7c 2s 9h 3d",
				}),
				"hand_board_length_check",
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
			seats: 2,
			actions: 1,
		});
	});

	test("deleting the entry removes its hands, seats and actions even when an all-in event links one of them", async ({
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
				stakes: { sb: 1, bb: 2 },
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
			stakes: { sb: 1, bb: 2 },
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
			seats: 0,
			actions: 0,
		});

		await api.db.insert(playEvent).values({
			id: "all-in",
			userId: "alice",
			entryId: "alice-entry",
			playSessionId: "alice-play",
			type: "all_in",
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
			board: "Ah Kd 7c 2s 9h",
			stakes: { sb: 100, bb: 200, ante: 200 },
			heroNet: 6400,
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
				board: "Qh Jh Th",
				pot: 900,
				heroNet: -300,
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
			board: "Qh Jh Th",
			heroNet: -300,
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
			board: null,
			pot: null,
			heroNet: null,
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
			seats: 0,
			actions: 0,
		});
	});

	test("the list pages a play session's hands from the newest with a hand-number cursor and carries each page's seats", async ({
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
		expect(firstPage.items[0]?.seats).toEqual([]);
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
