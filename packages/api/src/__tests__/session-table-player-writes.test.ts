import { describe, expect, it } from "vitest";
import { createCaller } from "./caller";

const OWNER = "owner-1";

describe("sessionTablePlayer.add seat validation against tournament table size", () => {
	const select = {
		game_session: [{ id: "s1", userId: OWNER, kind: "tournament" }],
		player: [{ id: "p1" }],
		session_event: [] as Record<string, unknown>[],
		session_tournament_detail: [{ tableSize: 6 }],
	};

	it("rejects a seat position at or beyond the tournament table size with BAD_REQUEST", async () => {
		const { caller } = createCaller({ select, userId: OWNER });
		await expect(
			caller.sessionTablePlayer.add({
				playerId: "p1",
				seatPosition: 7,
				sessionId: "s1",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("accepts a seat position within the tournament table size", async () => {
		const { caller } = createCaller({ select, userId: OWNER });
		await expect(
			caller.sessionTablePlayer.add({
				playerId: "p1",
				seatPosition: 5,
				sessionId: "s1",
			})
		).resolves.toEqual({ id: "p1", playerId: "p1" });
	});
});

describe("sessionTablePlayer.addTemporary memo built from the linked ring game", () => {
	it("includes the ring game's blinds in the new player's memo", async () => {
		const { caller, inserted } = createCaller({
			select: {
				game_session: [
					{ id: "s1", kind: "cash_game", roomId: null, userId: OWNER },
				],
				ring_game: [
					{ blind1: 1, blind2: 2, id: "rg1", name: "NLH", userId: OWNER },
				],
				session_cash_detail: [{ ringGameId: "rg1" }],
			},
			userId: OWNER,
		});

		await caller.sessionTablePlayer.addTemporary({ sessionId: "s1" });

		const inserted_player = inserted.player as { memo: string }[];
		expect(inserted_player[0]?.memo).toContain("1/2");
	});
});

describe("sessionTablePlayer.list", () => {
	it("resolves an empty items list when there are no session events", async () => {
		const { caller } = createCaller({
			select: {
				game_session: [{ id: "s1", kind: "cash_game", userId: OWNER }],
				session_event: [],
			},
			userId: OWNER,
		});

		await expect(
			caller.sessionTablePlayer.list({ sessionId: "s1" })
		).resolves.toEqual({ items: [] });
	});

	it.each([
		[true, ["p1"]],
		[false, ["p1", "p2"]],
	])("activeOnly=%s returns the players %s", async (activeOnly, expectedIds) => {
		const { caller } = createCaller({
			select: {
				game_session: [{ id: "s1", kind: "cash_game", userId: OWNER }],
				player: [
					{ id: "p1", isTemporary: false, memo: null, name: "Alice" },
					{ id: "p2", isTemporary: false, memo: null, name: "Bob" },
				],
				session_event: [
					{
						eventType: "player_join",
						id: "e1",
						occurredAt: new Date("2026-01-01T00:00:00Z"),
						payload: JSON.stringify({ playerId: "p1" }),
						sortOrder: 1,
					},
					{
						eventType: "player_join",
						id: "e2",
						occurredAt: new Date("2026-01-01T00:01:00Z"),
						payload: JSON.stringify({ playerId: "p2" }),
						sortOrder: 2,
					},
					{
						eventType: "player_leave",
						id: "e3",
						occurredAt: new Date("2026-01-01T00:02:00Z"),
						payload: JSON.stringify({ playerId: "p2" }),
						sortOrder: 3,
					},
				],
			},
			userId: OWNER,
		});

		const result = await caller.sessionTablePlayer.list({
			activeOnly,
			sessionId: "s1",
		});

		expect(result.items).toHaveLength(expectedIds.length);
		expect(result.items.map((item) => item.id)).toEqual(expectedIds);
	});
});

describe("sessionTablePlayer.add success", () => {
	it("records a player_join event and returns the player id", async () => {
		const { caller, inserted } = createCaller({
			select: {
				game_session: [{ id: "s1", kind: "cash_game", userId: OWNER }],
				player: [{ id: "p1" }],
				session_event: [],
			},
			userId: OWNER,
		});

		const result = await caller.sessionTablePlayer.add({
			playerId: "p1",
			seatPosition: 2,
			sessionId: "s1",
		});

		expect(result).toEqual({ id: "p1", playerId: "p1" });
		const insertedEvent = inserted.session_event as {
			eventType: string;
			payload: string;
		}[];
		expect(insertedEvent[0]?.eventType).toBe("player_join");
		expect(JSON.parse(insertedEvent[0]?.payload ?? "{}")).toEqual({
			playerId: "p1",
			seatPosition: 2,
		});
	});
});

describe("sessionTablePlayer.updateSeat success", () => {
	function seatedPlayerSelect() {
		return {
			game_session: [{ id: "s1", kind: "cash_game", userId: OWNER }],
			player: [{ id: "p1" }],
			session_event: [
				{
					eventType: "player_join",
					id: "e1",
					occurredAt: new Date("2026-01-01T00:00:00Z"),
					payload: JSON.stringify({ playerId: "p1" }),
					sortOrder: 1,
				},
			],
		};
	}

	it("stores the new seat position when given a number", async () => {
		const { caller, updated } = createCaller({
			select: seatedPlayerSelect(),
			userId: OWNER,
		});

		await caller.sessionTablePlayer.updateSeat({
			playerId: "p1",
			seatPosition: 5,
			sessionId: "s1",
		});

		const updatedEvent = updated.session_event as { payload: string }[];
		expect(JSON.parse(updatedEvent[0]?.payload ?? "{}")).toEqual({
			playerId: "p1",
			seatPosition: 5,
		});
	});

	it("drops the seat position from the payload when given null", async () => {
		const { caller, updated } = createCaller({
			select: seatedPlayerSelect(),
			userId: OWNER,
		});

		await caller.sessionTablePlayer.updateSeat({
			playerId: "p1",
			seatPosition: null,
			sessionId: "s1",
		});

		const updatedEvent = updated.session_event as { payload: string }[];
		expect(JSON.parse(updatedEvent[0]?.payload ?? "{}")).toEqual({
			playerId: "p1",
		});
	});
});

describe("sessionTablePlayer.remove success", () => {
	it("records a player_leave event and returns the player id", async () => {
		const { caller, inserted } = createCaller({
			select: {
				game_session: [{ id: "s1", kind: "cash_game", userId: OWNER }],
				player: [{ id: "p1" }],
				session_event: [
					{
						eventType: "player_join",
						id: "e1",
						occurredAt: new Date("2026-01-01T00:00:00Z"),
						payload: JSON.stringify({ playerId: "p1" }),
						sortOrder: 1,
					},
				],
			},
			userId: OWNER,
		});

		const result = await caller.sessionTablePlayer.remove({
			playerId: "p1",
			sessionId: "s1",
		});

		expect(result).toEqual({ id: "p1", playerId: "p1" });
		const insertedEvent = inserted.session_event as {
			eventType: string;
			payload: string;
		}[];
		expect(insertedEvent[0]?.eventType).toBe("player_leave");
		expect(JSON.parse(insertedEvent[0]?.payload ?? "{}")).toEqual({
			playerId: "p1",
		});
	});
});
