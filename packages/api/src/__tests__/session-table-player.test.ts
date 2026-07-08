import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { gameSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import {
	insertPlayerJoinEvent,
	insertPlayerLeaveEvent,
} from "../routers/session-table-player";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("sessionTablePlayer router structure", () => {
	it("appRouter has sessionTablePlayer namespace", () => {
		expect(appRouter.sessionTablePlayer).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTablePlayer).sort()).toEqual(
			["add", "addNew", "addTemporary", "list", "remove", "updateSeat"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.sessionTablePlayer.list);
		expectType(appRouter.sessionTablePlayer.list, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"add",
			"addNew",
			"addTemporary",
			"remove",
			"updateSeat",
		] as const) {
			const proc = appRouter.sessionTablePlayer[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("sessionTablePlayer.list input validation", () => {
	it("accepts empty object (activeOnly defaults to false)", () => {
		const schema = getInputSchema(appRouter.sessionTablePlayer.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { activeOnly: boolean };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.activeOnly).toBe(false);
	});

	it("accepts liveCashGameSessionId with explicit activeOnly=true", () => {
		expectAccepts(appRouter.sessionTablePlayer.list, {
			liveCashGameSessionId: "lcg1",
			activeOnly: true,
		});
	});

	it("accepts liveTournamentSessionId", () => {
		expectAccepts(appRouter.sessionTablePlayer.list, {
			liveTournamentSessionId: "lt1",
		});
	});

	it("accepts new sessionId field (CTI shim)", () => {
		expectAccepts(appRouter.sessionTablePlayer.list, {
			sessionId: "gs1",
		});
	});

	it("rejects non-boolean activeOnly", () => {
		expectRejects(appRouter.sessionTablePlayer.list, {
			activeOnly: "yes",
		});
	});
});

describe("sessionTablePlayer.add input validation", () => {
	it("accepts playerId + session id", () => {
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
		});
	});

	it("accepts seat position in range [0, 9]", () => {
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 0,
		});
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 8,
		});
	});

	it("accepts seat position 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 9,
		});
	});

	it("rejects seat position out of range", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 10,
		});
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: -1,
		});
	});

	it("rejects non-integer seat position", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 1.5,
		});
	});

	it("rejects empty playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
			playerId: "",
		});
	});

	it("rejects missing playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.add, {
			liveCashGameSessionId: "lcg1",
		});
	});
});

describe("sessionTablePlayer.addNew input validation", () => {
	it("accepts minimal valid payload", () => {
		expectAccepts(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "Guest",
		});
	});

	it("accepts playerMemo and playerTagIds", () => {
		expectAccepts(appRouter.sessionTablePlayer.addNew, {
			liveTournamentSessionId: "lt1",
			playerName: "Guest",
			playerMemo: "met at table",
			playerTagIds: ["t1", "t2"],
		});
	});

	it("rejects empty playerName", () => {
		expectRejects(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "",
		});
	});

	it("accepts seat position 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "Guest",
			seatPosition: 9,
		});
	});

	it("rejects seat position > 9", () => {
		expectRejects(appRouter.sessionTablePlayer.addNew, {
			liveCashGameSessionId: "lcg1",
			playerName: "Guest",
			seatPosition: 10,
		});
	});
});

describe("sessionTablePlayer.updateSeat input validation", () => {
	it("accepts seatPosition = null (leave seat)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: null,
		});
	});

	it("accepts valid seat positions (0 and 8 boundaries)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 0,
		});
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 8,
		});
	});

	it("accepts seat position 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 9,
		});
	});

	it("rejects seat position out of [0, 9]", () => {
		expectRejects(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: 10,
		});
	});

	it("rejects missing playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 1,
		});
	});
});

describe("sessionTablePlayer.remove input validation", () => {
	it("accepts valid payload", () => {
		expectAccepts(appRouter.sessionTablePlayer.remove, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
		});
	});

	it("rejects empty playerId", () => {
		expectRejects(appRouter.sessionTablePlayer.remove, {
			liveCashGameSessionId: "lcg1",
			playerId: "",
		});
	});
});

describe("sessionTablePlayer.addTemporary input validation", () => {
	it("accepts session id only (seat optional)", () => {
		expectAccepts(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
		});
	});

	it("accepts seat position", () => {
		expectAccepts(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 3,
		});
	});

	it("accepts seat position 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 9,
		});
	});

	it("rejects seat position > 9", () => {
		expectRejects(appRouter.sessionTablePlayer.addTemporary, {
			liveCashGameSessionId: "lcg1",
			seatPosition: 10,
		});
	});
});

function makeInsertEventDb(maxSortOrder: number | null) {
	const valuesSpy = vi.fn().mockResolvedValue(undefined);
	const insertSpy = vi.fn().mockReturnValue({ values: valuesSpy });
	const whereSpy = vi.fn().mockResolvedValue([{ maxSortOrder }]);
	const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
	const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });
	return {
		db: { select: selectSpy, insert: insertSpy },
		valuesSpy,
		insertSpy,
		whereSpy,
		fromSpy,
		selectSpy,
	};
}

function firstInsertedRow(valuesSpy: ReturnType<typeof vi.fn>) {
	const calls = valuesSpy.mock.calls;
	if (calls.length === 0 || !calls[0] || calls[0].length === 0) {
		throw new Error("expected values() to have been called at least once");
	}
	return calls[0][0] as Record<string, unknown>;
}

describe("insertPlayerJoinEvent (write-side ordering contract)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-24T17:30:45.123Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("floors occurredAt to the minute (no leaked seconds or ms)", async () => {
		const { db, valuesSpy } = makeInsertEventDb(null);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-1"
		);

		expect(valuesSpy).toHaveBeenCalledTimes(1);
		const inserted = firstInsertedRow(valuesSpy);
		expect(inserted.eventType).toBe("player_join");
		expect((inserted.occurredAt as Date).toISOString()).toBe(
			"2026-04-24T17:30:00.000Z"
		);
	});

	it("returns sortOrder = 0 only when the session has no events", async () => {
		const { db, valuesSpy } = makeInsertEventDb(null);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-1"
		);
		expect(firstInsertedRow(valuesSpy).sortOrder).toBe(0);
	});

	it("uses session-wide max(sortOrder) + 1, not a per-second scope", async () => {
		// Pre-existing event with sortOrder=5 at a different second.
		// The bug it guards against: scoping max(sortOrder) by `unixepoch(occurredAt) = nowUnix`
		// returned 0 here, colliding with the real session_start at sortOrder=0.
		const { db, valuesSpy } = makeInsertEventDb(5);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-1"
		);
		expect(firstInsertedRow(valuesSpy).sortOrder).toBe(6);
	});

	it("treats max(sortOrder) = 0 as a real value (returns 1)", async () => {
		const { db, valuesSpy } = makeInsertEventDb(0);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-1"
		);
		expect(firstInsertedRow(valuesSpy).sortOrder).toBe(1);
	});

	it("serializes the playerId into the payload", async () => {
		const { db, valuesSpy } = makeInsertEventDb(2);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-xyz"
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(JSON.parse(inserted.payload as string)).toEqual({
			playerId: "player-xyz",
		});
	});

	it("omits seatPosition from the payload when not provided", async () => {
		const { db, valuesSpy } = makeInsertEventDb(2);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-xyz"
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(JSON.parse(inserted.payload as string)).not.toHaveProperty(
			"seatPosition"
		);
	});

	it("serializes the seatPosition into the payload when provided", async () => {
		const { db, valuesSpy } = makeInsertEventDb(2);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-xyz",
			5
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(JSON.parse(inserted.payload as string)).toEqual({
			playerId: "player-xyz",
			seatPosition: 5,
		});
	});

	it("serializes seatPosition 0 (boundary) into the payload", async () => {
		const { db, valuesSpy } = makeInsertEventDb(2);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-xyz",
			0
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(JSON.parse(inserted.payload as string)).toEqual({
			playerId: "player-xyz",
			seatPosition: 0,
		});
	});
});

describe("insertPlayerLeaveEvent (write-side ordering contract)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-24T23:59:59.999Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("floors occurredAt to the minute even at the end-of-day boundary", async () => {
		const { db, valuesSpy } = makeInsertEventDb(3);
		await insertPlayerLeaveEvent(
			db as unknown as Parameters<typeof insertPlayerLeaveEvent>[0],
			"session-1",
			"player-1"
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(inserted.eventType).toBe("player_leave");
		expect((inserted.occurredAt as Date).toISOString()).toBe(
			"2026-04-24T23:59:00.000Z"
		);
	});

	it("appends with session-wide max(sortOrder) + 1", async () => {
		const { db, valuesSpy } = makeInsertEventDb(9);
		await insertPlayerLeaveEvent(
			db as unknown as Parameters<typeof insertPlayerLeaveEvent>[0],
			"session-1",
			"player-1"
		);
		expect(firstInsertedRow(valuesSpy).sortOrder).toBe(10);
	});

	it("serializes the playerId into the payload", async () => {
		const { db, valuesSpy } = makeInsertEventDb(0);
		await insertPlayerLeaveEvent(
			db as unknown as Parameters<typeof insertPlayerLeaveEvent>[0],
			"session-1",
			"player-abc"
		);
		const inserted = firstInsertedRow(valuesSpy);
		expect(JSON.parse(inserted.payload as string)).toEqual({
			playerId: "player-abc",
		});
	});
});

describe("sessionTablePlayer.addNew tag ownership (SA2-178)", () => {
	type Rows = Record<string, unknown>[];
	const OWNER = "owner-1";

	function createMockDb(rowsByTable: Map<unknown, Rows>) {
		const inserted: { table: unknown; values: unknown }[] = [];
		const makeChain = (rows: Rows) => {
			const chain = Promise.resolve(rows) as Promise<Rows> &
				Record<string, (...args: unknown[]) => unknown>;
			chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
			chain.where = () => chain;
			chain.orderBy = () => chain;
			chain.limit = () => chain;
			chain.innerJoin = () => chain;
			chain.leftJoin = () => chain;
			return chain;
		};
		return {
			db: {
				select: () => makeChain([]),
				insert: (table: unknown) => ({
					values: (values: unknown) => {
						inserted.push({ table, values });
						return Promise.resolve(undefined);
					},
				}),
				update: () => ({
					set: () => ({ where: () => Promise.resolve(undefined) }),
				}),
				delete: () => ({ where: () => Promise.resolve(undefined) }),
			},
			inserted,
		};
	}

	function makeCaller(rowsByTable: Map<unknown, Rows>) {
		const { db, inserted } = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<
			typeof appRouter.createCaller
		>[0]).sessionTablePlayer;
		return { caller, inserted };
	}

	function ownedSessionRows(extra: Map<unknown, Rows>) {
		const map = new Map<unknown, Rows>([
			[gameSession, [{ id: "s1", userId: OWNER, kind: "cash_game" }]],
		]);
		for (const [k, v] of extra) {
			map.set(k, v);
		}
		return map;
	}

	async function expectForbidden(promise: Promise<unknown>): Promise<void> {
		try {
			await promise;
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as { code: string }).code).toBe("FORBIDDEN");
			return;
		}
		throw new Error("expected the call to throw FORBIDDEN but it resolved");
	}

	it("accepts player tags owned by the caller and links them", async () => {
		const rows = ownedSessionRows(
			new Map<unknown, Rows>([[playerTag, [{ id: "t1" }, { id: "t2" }]]])
		);
		const { caller, inserted } = makeCaller(rows);
		await expect(
			caller.addNew({
				sessionId: "s1",
				playerName: "Alice",
				playerTagIds: ["t1", "t2"],
			})
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
	});

	it("rejects a player tag owned by another user and skips the join insert", async () => {
		const rows = ownedSessionRows(
			new Map<unknown, Rows>([[playerTag, [{ id: "t1" }]]])
		);
		const { caller, inserted } = makeCaller(rows);
		await expectForbidden(
			caller.addNew({
				sessionId: "s1",
				playerName: "Alice",
				playerTagIds: ["t1", "t2"],
			})
		);
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
	});

	it("does not validate tags when playerTagIds is omitted", async () => {
		const rows = ownedSessionRows(new Map());
		const { caller, inserted } = makeCaller(rows);
		await expect(
			caller.addNew({ sessionId: "s1", playerName: "Alice" })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
		// The player itself is still created.
		expect(inserted.some((i) => i.table === player)).toBe(true);
	});
});
