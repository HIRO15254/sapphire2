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
import { handTag } from "@sapphire2/db/schema/hand-tag";
import { player } from "@sapphire2/db/schema/player";
import { MAX_LINKED_TAGS } from "@sapphire2/db/schemas/tag-ids";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { chunkForInsert, D1_MAX_BOUND_PARAMS, runBatch } from "../lib/batch";
import {
	addHand,
	buildHandUpdateStatements,
	getHand,
	type HandUpdateInput,
} from "../services/hand";
import {
	type ApiFixture,
	AUTH_QUERY_RESERVE,
	D1_QUERIES_PER_INVOCATION,
	FOREIGN_KEY_FAILED,
	insert,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

type Owner = "alice" | "bob";
type Row = Record<string, string | number | null>;

const NOW = new Date("2026-09-05T10:00:00.000Z");

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
	await db.insert(player).values([
		{
			id: `${owner}-self`,
			userId: owner,
			name: "Hero",
			isSelf: true,
			updatedAt: NOW,
		},
		...Array.from({ length: 9 }, (_, index) => ({
			id: `${owner}-player-${index + 1}`,
			userId: owner,
			name: `Villain ${index + 1}`,
			updatedAt: NOW,
		})),
	]);
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

type FullHand = Extract<HandUpdateInput, { detail: "full" }>;

function fullHand(id: string, seats: number, actions: number): FullHand {
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
			playerId: seat === 0 ? "alice-self" : `alice-player-${seat}`,
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
		await api.alice.hand.update(fullHand(added.id, 3, 4));
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

describe("hand API on D1", () => {
	test("+1 numbers an active play session's hands from 1, and undo removes only the latest count hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const first = await api.alice.hand.add({
			playSessionId: "alice-play",
			buttonSeat: 3,
			stakes: { blind1: 1, blind2: 2 },
			variantId: "alice-variant",
			playedAt: NOW.getTime() / 1000,
		});
		const second = await api.alice.hand.add({
			playSessionId: "alice-play",
			buttonSeat: 4,
		});
		const bobs = await api.bob.hand.add({ playSessionId: "bob-play" });
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

		expect(
			await api.alice.hand.undoLast({ playSessionId: "alice-play" })
		).toEqual({ success: true });
		const third = await api.alice.hand.add({
			playSessionId: "alice-play",
			buttonSeat: 5,
		});
		expect(third.handNo).toBe(2);
		await api.alice.hand.update(fullHand(third.id, 2, 2));
		await expect(
			api.alice.hand.undoLast({ playSessionId: "alice-play" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, first.id],
			[2, third.id],
		]);

		await api.alice.hand.delete({ id: third.id });
		await api.alice.hand.undoLast({ playSessionId: "alice-play" });
		await expect(
			api.alice.hand.undoLast({ playSessionId: "alice-play" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await handNumbers(api.db, "alice-play")).toEqual([]);
		expect(await handNumbers(api.db, "bob-play")).toEqual([[1, bobs.id]]);
	});

	test("a paused or ended play session rejects +1 and undo but its hands stay readable and deletable", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const first = await countHand(api.db);
		const second = await countHand(api.db);

		for (const state of [
			{ status: "paused", endState: null },
			{ status: "ended", endState: "cashed_out" },
		] as const) {
			await api.db
				.update(playSession)
				.set(state)
				.where(eq(playSession.id, "alice-play"));
			await expect(
				api.alice.hand.add({ playSessionId: "alice-play" })
			).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			await expect(
				api.alice.hand.undoLast({ playSessionId: "alice-play" })
			).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
			expect(await handNumbers(api.db, "alice-play")).toEqual([
				[1, first],
				[2, second],
			]);
		}

		expect(await api.alice.hand.getById({ id: second })).toMatchObject({
			handNo: 2,
		});
		await api.alice.hand.delete({ id: first });
		expect(await handNumbers(api.db, "alice-play")).toEqual([[1, second]]);
	});

	test("concurrent +1 calls give every hand its own number", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");

		await Promise.all(
			Array.from({ length: 8 }, () =>
				api.alice.hand.add({ playSessionId: "alice-play" })
			)
		);

		const stored = await handNumbers(api.db, "alice-play");
		expect(stored.map(([handNo]) => handNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
	});

	test("deleting a hand closes the gap in hand numbers, and a hand linked to an all-in event is neither deleted nor undone", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const first = await countHand(api.db);
		const second = await countHand(api.db);
		const third = await countHand(api.db);
		const fourth = await countHand(api.db);
		await api.alice.hand.update(fullHand(second, 2, 3));

		await api.alice.hand.delete({ id: second });
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

		await api.db.insert(playEvent).values(
			[third, fourth].map((handId, sortOrder) => ({
				id: `all-in-${handId}`,
				userId: "alice",
				entryId: "alice-entry",
				playSessionId: "alice-play",
				type: "all_in",
				schemaVersion: 2,
				occurredAt: NOW,
				sortOrder,
				payload: "{}",
				handId,
				updatedAt: NOW,
			}))
		);
		await expect(api.alice.hand.delete({ id: third })).rejects.toMatchObject({
			code: "CONFLICT",
		});
		await expect(
			api.alice.hand.undoLast({ playSessionId: "alice-play" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await handNumbers(api.db, "alice-play")).toEqual([
			[1, first],
			[2, third],
			[3, fourth],
		]);

		const next = await api.alice.hand.add({ playSessionId: "alice-play" });
		expect(next.handNo).toBe(4);
	});

	test("the list pages hands from the newest with a string cursor that survives deleting its boundary hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const ids = ["hand-1", "hand-2", "hand-3", "hand-4", "hand-5"] as const;
		const [first, second, third, fourth, fifth] = ids;
		for (const [index, id] of ids.entries()) {
			await insert(
				api.d1,
				"hand",
				handRow(id, "alice", { hand_no: index + 1 })
			);
		}
		await api.alice.hand.update(fullHand(fourth, 2, 1));

		const firstPage = await api.alice.hand.list({
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
		const cursor = firstPage.nextCursor;
		if (cursor === null) {
			throw new Error("Expected a second page");
		}

		await api.alice.hand.delete({ id: fourth });
		const secondPage = await api.alice.hand.list({
			playSessionId: "alice-play",
			limit: 2,
			cursor,
		});
		expect(secondPage.items.map(({ id }) => id)).toEqual([third, second]);
		const lastPage = await api.alice.hand.list({
			playSessionId: "alice-play",
			limit: 2,
			cursor: secondPage.nextCursor ?? undefined,
		});
		expect(lastPage.items.map(({ id }) => id)).toEqual([first]);
		expect(lastPage.nextCursor).toBeNull();

		const bobHand = await api.bob.hand.add({ playSessionId: "bob-play" });
		await expect(
			api.bob.hand.list({ playSessionId: "bob-play", cursor })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.hand.list({
				playSessionId: "alice-play",
				cursor: "not-a-cursor",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await api.alice.hand.list({ playSessionId: "alice-play" })).items
		).toHaveLength(4);
		expect(
			(await api.bob.hand.list({ playSessionId: "bob-play" })).items.map(
				({ id }) => id
			)
		).toEqual([bobHand.id]);
	});

	test("another user's play session, hand and cursor are uniformly forbidden", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const aliceHand = await countHand(api.db);
		await countHand(api.db);
		const page = await api.alice.hand.list({
			playSessionId: "alice-play",
			limit: 1,
		});
		expect(page.nextCursor).not.toBeNull();

		const attempts = [
			() => api.bob.hand.list({ playSessionId: "alice-play" }),
			() =>
				api.bob.hand.list({
					playSessionId: "alice-play",
					cursor: page.nextCursor ?? undefined,
				}),
			() => api.bob.hand.getById({ id: aliceHand }),
			() => api.bob.hand.add({ playSessionId: "alice-play" }),
			() =>
				api.bob.hand.add({
					playSessionId: "bob-play",
					variantId: "alice-variant",
				}),
			() => api.bob.hand.undoLast({ playSessionId: "alice-play" }),
			() => api.bob.hand.delete({ id: aliceHand }),
			() => api.bob.hand.getById({ id: "missing" }),
			() => api.bob.hand.list({ playSessionId: "missing" }),
		];
		for (const attempt of attempts) {
			await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		expect((await handNumbers(api.db, "alice-play")).length).toBe(2);
		expect(await handNumbers(api.db, "bob-play")).toEqual([]);
	});

	test("a player in a table event cannot be deleted even without a hand seat", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await insert(
			api.d1,
			"play_event",
			eventRow("join", "alice", {
				type: "player_join",
				payload: JSON.stringify({
					playerId: "alice-player-1",
					seatPosition: 2,
				}),
			})
		);
		await expect(
			api.alice.player.delete({ id: "alice-player-1" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			await api.alice.player.getById({ id: "alice-player-1" })
		).toMatchObject({
			id: "alice-player-1",
		});
		await expect(
			api.alice.player.delete({ id: "alice-player-2" })
		).resolves.toEqual({
			success: true,
		});
	});

	test("a player seated in a recorded hand cannot be deleted, so the hand keeps its opponent", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		await api.alice.hand.update(fullHand(added, 3, 2));

		await expect(
			api.alice.player.delete({ id: "alice-player-1" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		await expect(
			api.bob.player.delete({ id: "alice-player-1" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(
			(await api.alice.hand.getById({ id: added })).seats.map(
				({ seat, playerId }) => [seat, playerId]
			)
		).toEqual([
			[0, "alice-self"],
			[1, "alice-player-1"],
			[2, "alice-player-2"],
		]);

		await api.alice.player.delete({ id: "alice-player-3" });
		expect(
			await api.db
				.select({ id: player.id })
				.from(player)
				.where(eq(player.id, "alice-player-3"))
		).toEqual([]);
	});
});

function countBody(id: string): Extract<HandUpdateInput, { detail: "count" }> {
	return {
		id,
		detail: "count",
		buttonSeat: 2,
		tableSize: null,
		levelOrdinal: null,
		stakes: null,
		variantId: null,
	};
}

function summaryBody(
	id: string,
	heroPlayerId = "alice-self"
): Extract<HandUpdateInput, { detail: "summary" }> {
	return {
		id,
		detail: "summary",
		buttonSeat: 1,
		tableSize: 6,
		levelOrdinal: null,
		stakes: null,
		variantId: null,
		boards: ["Qh Jh Th"],
		pot: 900,
		rake: null,
		memo: "Hero flopped a straight",
		hero: {
			seat: 4,
			playerId: heroPlayerId,
			startStack: 10_000,
			holeCards: "9h 8h",
			net: -300,
			showed: true,
		},
	};
}

async function seedHandTags(api: ApiFixture, count: number) {
	const rows = Array.from({ length: count }, (_, index) => ({
		id: `alice-hand-tag-${index}`,
		userId: "alice",
		name: `Tag ${index}`,
		sortOrder: index,
		updatedAt: NOW,
	}));
	for (const chunk of chunkForInsert(rows, Object.keys(rows[0] ?? {}).length)) {
		await api.db.insert(handTag).values(chunk);
	}
	return rows.map(({ id }) => id);
}

describe("hand.update on D1", () => {
	test("count, summary, full, summary and count replace the whole detail each time and leave no child of a lowered level", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);

		const summary = await api.alice.hand.update(summaryBody(added));
		expect(summary).toMatchObject({
			id: added,
			handNo: 1,
			detail: "summary",
			boards: ["Qh Jh Th"],
			pot: 900,
			memo: "Hero flopped a straight",
			actions: [],
		});
		expect(summary.seats).toEqual([
			{
				seat: 4,
				playerId: "alice-self",
				isHero: true,
				startStack: 10_000,
				holeCards: "9h 8h",
				net: -300,
				showed: true,
			},
		]);

		const full = await api.alice.hand.update(fullHand(added, 6, 12));
		expect(full).toMatchObject({
			detail: "full",
			boards: ["Ah Kd 7c 2s 9h", "Ah Kd 7c 3d 4c"],
			stakes: { blind1: 100, blind2: 200, ante: 200, anteType: "bb" },
			memo: "Long hand",
		});
		expect(full.seats.map(({ seat, isHero }) => [seat, isHero])).toEqual([
			[0, true],
			[1, false],
			[2, false],
			[3, false],
			[4, false],
			[5, false],
		]);
		expect(full.actions.map(({ seq }) => seq)).toEqual(
			Array.from({ length: 12 }, (_, index) => index + 1)
		);
		expect(await api.alice.hand.getById({ id: added })).toEqual(full);

		await api.alice.hand.update(summaryBody(added));
		expect(await childCounts(api.db, added)).toEqual({
			boards: 1,
			seats: 1,
			actions: 0,
		});

		const count = await api.alice.hand.update(countBody(added));
		expect(count).toMatchObject({
			detail: "count",
			buttonSeat: 2,
			boards: [],
			pot: null,
			rake: null,
			memo: null,
			seats: [],
			actions: [],
		});
		expect(await childCounts(api.db, added)).toEqual({
			boards: 0,
			seats: 0,
			actions: 0,
		});
		expect(await handNumbers(api.db, "alice-play")).toEqual([[1, added]]);
	});

	test("an empty variant id is rejected before it can reach the foreign key", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		await expect(
			api.alice.hand.add({ playSessionId: "alice-play", variantId: "" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.hand.update({ ...countBody(added), variantId: "" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await api.alice.hand.getById({ id: added })).variantId).toBeNull();
	});

	test("isHero follows the self player, and a summary seat that is not self is rejected without touching the hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const added = await countHand(api.db);
		const heroOnSeatTwo = fullHand(added, 3, 0);
		heroOnSeatTwo.seats = heroOnSeatTwo.seats.map((seat) => ({
			...seat,
			playerId: [null, "alice-player-1", "alice-self"][seat.seat] ?? null,
		}));

		const saved = await api.alice.hand.update(heroOnSeatTwo);
		expect(
			saved.seats.map(({ seat, playerId, isHero }) => [seat, playerId, isHero])
		).toEqual([
			[0, null, false],
			[1, "alice-player-1", false],
			[2, "alice-self", true],
		]);

		await expect(
			api.alice.hand.update(summaryBody(added, "alice-player-1"))
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const twice = fullHand(added, 3, 0);
		twice.seats = twice.seats.map((seat) => ({
			...seat,
			playerId: "alice-self",
		}));
		await expect(api.alice.hand.update(twice)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(await api.alice.hand.getById({ id: added })).toEqual(saved);
	});

	test("another user's hand, player, game variant and tag are forbidden and leave both users' hands as they were", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		await seedOwner(api.db, "bob");
		const added = await countHand(api.db);
		const aliceTag = await api.alice.handTag.create({ name: "Mine" });
		const bobHand = (await api.bob.hand.add({ playSessionId: "bob-play" })).id;
		const bobBody = (body: FullHand): FullHand => ({
			...body,
			variantId: null,
			seats: body.seats.map((seat) => ({
				...seat,
				playerId: seat.playerId?.replace("alice", "bob") ?? null,
			})),
		});
		const before = await api.bob.hand.getById({ id: bobHand });

		for (const attempt of [
			() => api.bob.hand.update(bobBody(fullHand(added, 2, 2))),
			() => api.bob.hand.update(fullHand(bobHand, 2, 2)),
			() =>
				api.bob.hand.update({
					...bobBody(fullHand(bobHand, 2, 2)),
					variantId: "alice-variant",
				}),
			() => api.bob.hand.update(summaryBody(bobHand, "alice-self")),
			() =>
				api.bob.hand.update({ ...countBody(bobHand), tagIds: [aliceTag.id] }),
			() =>
				api.bob.hand.update({
					...countBody(bobHand),
					tagReviews: [{ tagId: aliceTag.id, reviewedAt: null }],
				}),
			() =>
				api.bob.hand.update({
					...countBody(bobHand),
					tagReviews: [{ tagId: "missing-tag", reviewedAt: null }],
				}),
		]) {
			await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await api.bob.hand.getById({ id: bobHand })).toEqual(before);
		expect(await childCounts(api.db, added)).toEqual({
			boards: 0,
			seats: 0,
			actions: 0,
		});
		expect(
			await api.bob.hand.update(bobBody(fullHand(bobHand, 2, 2)))
		).toMatchObject({
			detail: "full",
			seats: [
				{ playerId: "bob-self", isHero: true },
				{ playerId: "bob-player-1", isHero: false },
			],
		});
	});

	test("tagIds replace the links, a kept tag keeps its review time, and tagReviews may name only attached tags", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		const first = await api.alice.handTag.create({ name: "A" });
		const second = await api.alice.handTag.create({ name: "B" });
		const third = await api.alice.handTag.create({ name: "C" });
		const reviewed = NOW.getTime() / 1000;
		const later = new Date(NOW.getTime() + 60_000);
		const tagsOf = async () =>
			(await api.alice.hand.getById({ id: added })).tags
				.map(({ name, reviewedAt }) => [name, reviewedAt])
				.sort(([a], [b]) => String(a).localeCompare(String(b)));

		await api.alice.hand.update({
			...countBody(added),
			tagIds: [first.id, second.id],
			tagReviews: [{ tagId: first.id, reviewedAt: reviewed }],
		});
		expect(await tagsOf()).toEqual([
			["A", NOW],
			["B", null],
		]);

		await api.alice.hand.update({
			...countBody(added),
			tagIds: [first.id, third.id],
		});
		await api.alice.hand.update(countBody(added));
		expect(await tagsOf()).toEqual([
			["A", NOW],
			["C", null],
		]);

		await api.alice.hand.update({
			...countBody(added),
			tagReviews: [
				{ tagId: first.id, reviewedAt: null },
				{ tagId: third.id, reviewedAt: later.getTime() / 1000 },
			],
		});
		expect(await tagsOf()).toEqual([
			["A", null],
			["C", later],
		]);

		for (const body of [
			{ tagReviews: [{ tagId: second.id, reviewedAt: reviewed }] },
			{
				tagIds: [first.id],
				tagReviews: [{ tagId: third.id, reviewedAt: reviewed }],
			},
		]) {
			await expect(
				api.alice.hand.update({ ...countBody(added), ...body })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		expect(await tagsOf()).toEqual([
			["A", null],
			["C", later],
		]);
	});

	test("a full hand at the seat, action, board and tag maxima is saved within the D1 query budget", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		const tagIds = await seedHandTags(api, MAX_LINKED_TAGS);
		const input: FullHand = {
			...fullHand(added, 10, 200),
			boards: [
				"Ah Kd 7c 2s 9h",
				"Ah Kd 7c 3d 4c",
				"Ah Kd 7c 5h 6h",
				"Ah Kd 7c 8d Tc",
			],
			tagIds,
			tagReviews: tagIds.map((tagId) => ({
				tagId,
				reviewedAt: NOW.getTime() / 1000,
			})),
		};

		for (const statement of buildHandUpdateStatements(
			api.db,
			"alice",
			input,
			{
				selfPlayerId: "alice-self",
				tagLinks: tagIds.map((tagId) => ({ tagId, reviewedAt: NOW })),
			},
			NOW
		)) {
			if (!("toSQL" in statement && typeof statement.toSQL === "function")) {
				throw new Error("Expected a query builder statement");
			}
			expect(statement.toSQL().params.length).toBeLessThanOrEqual(
				D1_MAX_BOUND_PARAMS
			);
		}
		const { caller, meter } = api.meteredCaller("alice");
		const saved = await caller.hand.update(input);
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
		expect(saved.boards).toHaveLength(4);
		expect(saved.seats).toHaveLength(10);
		expect(saved.actions.map(({ seq }) => seq)).toEqual(
			Array.from({ length: 200 }, (_, index) => index + 1)
		);
		expect(saved.actions.at(-1)).toEqual({
			seq: 200,
			street: 3,
			seat: 9,
			action: "call",
			amount: 40_000,
			allIn: false,
		});
		expect(saved.tags).toHaveLength(MAX_LINKED_TAGS);
		expect(
			saved.tags.every(
				({ reviewedAt }) => reviewedAt?.getTime() === NOW.getTime()
			)
		).toBe(true);
	});

	test("a save whose last action statement fails keeps every previous detail of the hand", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		const before = await api.alice.hand.update(fullHand(added, 3, 4));
		const broken = fullHand(added, 3, 200);
		broken.memo = "Overwritten";
		broken.actions = broken.actions.map((action, index) =>
			index === broken.actions.length - 1 ? { ...action, seat: 9 } : action
		);

		const statements = buildHandUpdateStatements(
			api.db,
			"alice",
			broken,
			{ selfPlayerId: "alice-self", tagLinks: undefined },
			NOW
		);
		await expect(runBatch(api.db, statements)).rejects.toThrow(
			FOREIGN_KEY_FAILED
		);
		expect(await getHand(api.db, "alice", added)).toEqual(before);
	});

	test("hand reads return the owner's linked tags in tag order with their review time", async ({
		api,
	}) => {
		await seedOwner(api.db, "alice");
		const added = await countHand(api.db);
		const later = await countHand(api.db);
		const second = await api.alice.handTag.create({ name: "Second" });
		const first = await api.alice.handTag.create({ name: "First" });
		await api.alice.handTag.reorder({ ids: [first.id, second.id] });
		await insert(api.d1, "hand_tag_link", {
			user_id: "alice",
			hand_id: added,
			tag_id: second.id,
			reviewed_at: null,
		});
		await insert(api.d1, "hand_tag_link", {
			user_id: "alice",
			hand_id: added,
			tag_id: first.id,
			reviewed_at: NOW.getTime() / 1000,
		});
		const expected = [
			{ id: first.id, name: "First", reviewedAt: NOW },
			{ id: second.id, name: "Second", reviewedAt: null },
		];

		expect((await api.alice.hand.getById({ id: added })).tags).toEqual(
			expected
		);
		const listed = await api.alice.hand.list({ playSessionId: "alice-play" });
		expect(listed.items.map(({ id, tags }) => [id, tags])).toEqual([
			[later, []],
			[added, expected],
		]);
	});
});

describe("all-in hand link on D1", () => {
	async function startCash(api: ApiFixture) {
		const rule = await nlhGame(api.db);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ name: "JPY", kind: "currency" })
		);
		const started = await api.alice.live.create({
			kind: "cash",
			rule,
			startedAt: Math.floor(Date.now() / 1000) - 3600,
			payments: [
				{ role: "buy_in", assetId: jpy.id, quantity: 10_000, effect: "real" },
			],
		});
		const playSessionId = started.playSessions[0]?.id ?? "";
		const manual = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule,
		});
		return {
			entryId: started.id,
			playSessionId,
			otherDayId: manual.playSessions[0]?.id ?? "",
		};
	}

	async function storedLink(api: ApiFixture, id: string) {
		const [row] = await api.db
			.select({ handId: playEvent.handId, payload: playEvent.payload })
			.from(playEvent)
			.where(eq(playEvent.id, id));
		return row && { handId: row.handId, payload: JSON.parse(row.payload) };
	}

	test("an all-in links a hand of its own play session, refuses other users' and other days' hands, and must be unlinked before the hand is deleted", async ({
		api,
	}) => {
		const { entryId, playSessionId, otherDayId } = await startCash(api);
		await seedOwner(api.db, "bob");
		await insert(api.d1, "hand", handRow("bob-hand", "bob"));
		await insert(
			api.d1,
			"hand",
			handRow("other-day-hand", "alice", { play_session_id: otherDayId })
		);
		const linked = await api.alice.hand.add({ playSessionId });
		const later = await api.alice.hand.add({ playSessionId });
		const values = { potSize: 1000, trials: 1, equity: 50, wins: 1 };

		const allIn = await api.alice.playEvent.create({
			entryId,
			eventType: "all_in",
			payload: { ...values, handId: linked.id },
		});
		expect(allIn.payload).toEqual({ ...values, handId: linked.id });
		expect(await storedLink(api, allIn.id)).toEqual({
			handId: linked.id,
			payload: values,
		});

		for (const handId of ["bob-hand", "other-day-hand", "missing"]) {
			await expect(
				api.alice.playEvent.create({
					entryId,
					eventType: "all_in",
					payload: { ...values, handId },
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.playEvent.update({
					id: allIn.id,
					payload: { ...values, handId },
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await storedLink(api, allIn.id)).toEqual({
			handId: linked.id,
			payload: values,
		});
		expect(await api.alice.playEvent.list({ entryId })).toHaveLength(2);

		await expect(
			api.alice.hand.delete({ id: linked.id })
		).rejects.toMatchObject({ code: "CONFLICT" });
		const occurred = await api.alice.playEvent.update({
			id: allIn.id,
			occurredAt: Math.floor(Date.now() / 1000) - 60,
		});
		expect(occurred.payload).toEqual({ ...values, handId: linked.id });

		const unlinked = await api.alice.playEvent.update({
			id: allIn.id,
			payload: values,
		});
		expect(unlinked.payload).toEqual(values);
		expect(await storedLink(api, allIn.id)).toEqual({
			handId: null,
			payload: values,
		});
		await api.alice.hand.delete({ id: linked.id });
		expect(await handNumbers(api.db, playSessionId)).toEqual([[1, later.id]]);
	});
});
