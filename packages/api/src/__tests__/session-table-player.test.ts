import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import {
	insertPlayerJoinEvent,
	insertPlayerLeaveEvent,
} from "../routers/session-table-player";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

const seatWriters = [
	[
		"add",
		appRouter.sessionTablePlayer.add,
		{ sessionId: "s1", playerId: "p1" },
	],
	[
		"addNew",
		appRouter.sessionTablePlayer.addNew,
		{ sessionId: "s1", playerName: "Guest" },
	],
	[
		"updateSeat",
		appRouter.sessionTablePlayer.updateSeat,
		{ sessionId: "s1", playerId: "p1" },
	],
	[
		"addTemporary",
		appRouter.sessionTablePlayer.addTemporary,
		{ sessionId: "s1" },
	],
] as const;

const playerIdWriters = [
	["add", appRouter.sessionTablePlayer.add, { sessionId: "s1" }],
	[
		"updateSeat",
		appRouter.sessionTablePlayer.updateSeat,
		{ sessionId: "s1", seatPosition: null },
	],
	["remove", appRouter.sessionTablePlayer.remove, { sessionId: "s1" }],
] as const;

describe("sessionTablePlayer router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTablePlayer).sort()).toEqual(
			["add", "addNew", "addTemporary", "list", "remove", "updateSeat"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.sessionTablePlayer, {
			add: "mutation",
			addNew: "mutation",
			addTemporary: "mutation",
			list: "query",
			remove: "mutation",
			updateSeat: "mutation",
		});
	});
});

describe("sessionTablePlayer.list input validation", () => {
	it("defaults activeOnly to false", () => {
		const schema = getInputSchema(appRouter.sessionTablePlayer.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { activeOnly: boolean };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.activeOnly).toBe(false);
	});

	it.each([
		"sessionId",
		"liveCashGameSessionId",
		"liveTournamentSessionId",
	])("accepts %s as the session locator", (key) => {
		expectAccepts(appRouter.sessionTablePlayer.list, { [key]: "s1" });
	});
});

describe("sessionTablePlayer seat position validation", () => {
	it.each(
		seatWriters
	)("%s accepts seat positions 0 and 9 (10-max table)", (_name, procedure, base) => {
		for (const seatPosition of [0, 9]) {
			expectAccepts(procedure, { ...base, seatPosition });
		}
	});

	it.each(
		seatWriters
	)("%s rejects seat positions -1, 10 and 1.5", (_name, procedure, base) => {
		for (const seatPosition of [-1, 10, 1.5]) {
			expectRejects(procedure, { ...base, seatPosition });
		}
	});
});

describe("sessionTablePlayer playerId validation", () => {
	it.each(
		playerIdWriters
	)("%s rejects an empty playerId", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, playerId: "" });
	});
});

describe("sessionTablePlayer.addNew input validation", () => {
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
});

describe("sessionTablePlayer.updateSeat input validation", () => {
	it("accepts seatPosition = null (leave seat)", () => {
		expectAccepts(appRouter.sessionTablePlayer.updateSeat, {
			liveCashGameSessionId: "lcg1",
			playerId: "p1",
			seatPosition: null,
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

function expectAtomicAppendSortOrder(
	valuesSpy: ReturnType<typeof vi.fn>,
	sessionId: string
) {
	const sortOrder = firstInsertedRow(valuesSpy).sortOrder;
	const query = new SQLiteSyncDialect().sqlToQuery(sortOrder as never);
	const normalizedSql = query.sql.toLowerCase();

	expect(normalizedSql).toContain("coalesce(max(");
	expect(normalizedSql).toContain('from "session_event"');
	expect(normalizedSql).toContain('where "session_event"."session_id" = ?');
	expect(normalizedSql).toContain("+ 1");
	expect(query.params).toEqual([sessionId]);
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

	it("allocates sortOrder inside the player_join INSERT", async () => {
		const { db, valuesSpy } = makeInsertEventDb(null);
		await insertPlayerJoinEvent(
			db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
			"session-1",
			"player-1"
		);
		expectAtomicAppendSortOrder(valuesSpy, "session-1");
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

	it("allocates sortOrder inside the player_leave INSERT", async () => {
		const { db, valuesSpy } = makeInsertEventDb(9);
		await insertPlayerLeaveEvent(
			db as unknown as Parameters<typeof insertPlayerLeaveEvent>[0],
			"session-1",
			"player-1"
		);
		expectAtomicAppendSortOrder(valuesSpy, "session-1");
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

describe("concurrent player event append (SA2-196)", () => {
	it("submits both append allocations inside their INSERTs without a MAX pre-read", async () => {
		const { db, selectSpy, valuesSpy } = makeInsertEventDb(null);

		await Promise.all([
			insertPlayerJoinEvent(
				db as unknown as Parameters<typeof insertPlayerJoinEvent>[0],
				"session-1",
				"player-1"
			),
			insertPlayerLeaveEvent(
				db as unknown as Parameters<typeof insertPlayerLeaveEvent>[0],
				"session-1",
				"player-2"
			),
		]);

		expect(selectSpy).not.toHaveBeenCalled();
		expect(valuesSpy).toHaveBeenCalledTimes(2);
		const insertedRows = valuesSpy.mock.calls.map(
			([row]) => row as Record<string, unknown>
		);
		expect(insertedRows.map(({ eventType }) => eventType)).toEqual([
			"player_join",
			"player_leave",
		]);
		for (const row of insertedRows) {
			const query = new SQLiteSyncDialect().sqlToQuery(row.sortOrder as never);
			const normalizedSql = query.sql.toLowerCase();
			expect(normalizedSql).toContain("coalesce(max(");
			expect(normalizedSql).toContain('from "session_event"');
			expect(normalizedSql).toContain('where "session_event"."session_id" = ?');
			expect(normalizedSql).toContain("+ 1");
			expect(query.params).toEqual(["session-1"]);
		}
	});
});
describe("sessionTablePlayer.addNew tag ownership (SA2-178)", () => {
	type Rows = Record<string, unknown>[];
	const OWNER = "owner-1";

	function createMockDb(rowsByTable: Map<unknown, Rows>) {
		const inserted: { table: unknown; values: unknown }[] = [];
		const batch = vi.fn().mockResolvedValue(undefined);
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
				batch,
			},
			inserted,
			batch,
		};
	}

	function makeCaller(rowsByTable: Map<unknown, Rows>) {
		const { db, inserted, batch } = createMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<
			typeof appRouter.createCaller
		>[0]).sessionTablePlayer;
		return { caller, inserted, batch };
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
		const { caller, inserted, batch } = makeCaller(rows);
		await expect(
			caller.addNew({
				sessionId: "s1",
				playerName: "Alice",
				playerTagIds: ["t1", "t2"],
			})
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
		expect(batch).toHaveBeenCalledTimes(1);
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
	it("batches player, 34 tag links in D1-safe chunks, and join event", async () => {
		const tagIds = Array.from({ length: 34 }, (_, index) => `t${index}`);
		const rows = ownedSessionRows(
			new Map<unknown, Rows>([[playerTag, tagIds.map((id) => ({ id }))]])
		);
		const { caller, inserted, batch } = makeCaller(rows);

		await caller.addNew({
			sessionId: "s1",
			playerName: "Alice",
			playerTagIds: tagIds,
		});

		const linkInserts = inserted
			.filter((entry) => entry.table === playerToPlayerTag)
			.map((entry) => (entry.values as unknown[]).length);
		expect(linkInserts).toEqual([33, 1]);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
	});

	it("surfaces a batch failure instead of committing sequential writes", async () => {
		const rows = ownedSessionRows(new Map());
		const { caller, batch } = makeCaller(rows);
		batch.mockRejectedValueOnce(new Error("batch failed"));

		await expect(
			caller.addNew({ sessionId: "s1", playerName: "Alice" })
		).rejects.toThrow("batch failed");
		expect(batch).toHaveBeenCalledTimes(1);
	});

	it("does not validate tags when playerTagIds is omitted", async () => {
		const rows = ownedSessionRows(new Map());
		const { caller, inserted } = makeCaller(rows);
		await expect(
			caller.addNew({ sessionId: "s1", playerName: "Alice" })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
		expect(inserted.some((i) => i.table === player)).toBe(true);
	});

	it("batches temporary player and join event in one atomic write", async () => {
		const rows = ownedSessionRows(new Map());
		const { caller, batch } = makeCaller(rows);

		await caller.addTemporary({ sessionId: "s1" });

		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
	});

	it("surfaces addTemporary batch failure without sequential writes", async () => {
		const rows = ownedSessionRows(new Map());
		const { caller, batch } = makeCaller(rows);
		batch.mockRejectedValueOnce(new Error("batch failed"));

		await expect(caller.addTemporary({ sessionId: "s1" })).rejects.toThrow(
			"batch failed"
		);
		expect(batch).toHaveBeenCalledTimes(1);
	});
});

describe("sessionTablePlayer.list D1-safe ownership hydration", () => {
	type Rows = Record<string, unknown>[];
	const OWNER = "owner-1";
	const dialect = new SQLiteSyncDialect();

	function createListDb(rowsByTable: Map<unknown, Rows>) {
		const playerWhereParams: unknown[][] = [];
		const makeChain = (rows: Rows, table?: unknown) => {
			const chain = Promise.resolve(rows) as Promise<Rows> &
				Record<string, (...args: unknown[]) => unknown>;
			chain.from = (nextTable: unknown) =>
				makeChain(rowsByTable.get(nextTable) ?? [], nextTable);
			chain.where = (condition: unknown) => {
				if (table !== player) {
					return chain;
				}
				const params = dialect.sqlToQuery(condition as never).params;
				playerWhereParams.push(params);
				const ids = new Set(params.filter((value) => value !== OWNER));
				return makeChain(
					rows.filter((row) => row.userId === OWNER && ids.has(row.id)),
					table
				);
			};
			chain.orderBy = () => chain;
			chain.limit = () => chain;
			chain.innerJoin = () => chain;
			chain.leftJoin = () => chain;
			return chain;
		};
		return {
			db: { select: () => makeChain([]) },
			playerWhereParams,
		};
	}

	it("chunks 101 player ids and scopes every lookup to the caller", async () => {
		const events = Array.from({ length: 101 }, (_, index) => ({
			id: `event-${index}`,
			eventType: "player_join",
			payload: JSON.stringify({ playerId: `player-${index}` }),
			occurredAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
			sortOrder: index,
		}));
		const players = Array.from({ length: 101 }, (_, index) => ({
			id: `player-${index}`,
			name: `Player ${index}`,
			memo: null,
			isTemporary: false,
			userId: index === 100 ? "other-user" : OWNER,
		}));
		const { db, playerWhereParams } = createListDb(
			new Map<unknown, Rows>([
				[gameSession, [{ id: "s1", userId: OWNER, kind: "cash_game" }]],
				[sessionEvent, events],
				[player, players],
			])
		);
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<
			typeof appRouter.createCaller
		>[0]).sessionTablePlayer;

		const result = await caller.list({ sessionId: "s1" });

		expect(result.items).toHaveLength(100);
		expect(playerWhereParams).toHaveLength(2);
		expect(playerWhereParams.map((params) => params.length)).toEqual([100, 3]);
		expect(playerWhereParams.every((params) => params.includes(OWNER))).toBe(
			true
		);
	});
});

const ownershipDialect = new SQLiteSyncDialect();
const AUTH_OWNER = "owner-1";

type AuthorizationChain = Promise<Record<string, unknown>[]> &
	Record<string, (...args: unknown[]) => AuthorizationChain>;

function createAuthorizationDb(
	rowsByTable: Map<unknown, Record<string, unknown>[]>
) {
	const whereParams = new Map<unknown, unknown[][]>();
	const joinParams: { params: unknown[]; table: unknown }[] = [];
	const makeChain = (
		rows: Record<string, unknown>[],
		table?: unknown
	): AuthorizationChain => {
		const chain = Promise.resolve(rows) as AuthorizationChain;
		chain.from = (nextTable: unknown) =>
			makeChain(rowsByTable.get(nextTable) ?? [], nextTable);
		chain.where = (condition: unknown) => {
			const params = ownershipDialect.sqlToQuery(condition as never).params;
			const calls = whereParams.get(table) ?? [];
			calls.push(params);
			whereParams.set(table, calls);
			const filtered = params.includes(AUTH_OWNER)
				? rows.filter(
						(row) => row.userId === undefined || row.userId === AUTH_OWNER
					)
				: rows;
			return makeChain(filtered, table);
		};
		chain.innerJoin = (joinedTable: unknown, condition: unknown) => {
			joinParams.push({
				table: joinedTable,
				params: ownershipDialect.sqlToQuery(condition as never).params,
			});
			return chain;
		};
		chain.leftJoin = () => chain;
		chain.limit = () => chain;
		chain.orderBy = () => chain;
		return chain;
	};
	return {
		db: {
			select: () => makeChain([]),
			insert: () => ({ values: () => Promise.resolve(undefined) }),
			batch: () => Promise.resolve(undefined),
		},
		joinParams,
		whereParams,
	};
}

function authorizationCaller(db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: AUTH_OWNER } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.sessionTablePlayer;
}

function ownedAuthorizationSession(kind: "cash_game" | "tournament") {
	return {
		id: "s1",
		userId: AUTH_OWNER,
		kind,
		status: "active",
		source: "live",
		roomId: null,
		currencyId: null,
	};
}

function playerAuthorizationRows(playerRows: Record<string, unknown>[]) {
	return new Map<unknown, Record<string, unknown>[]>([
		[gameSession, [ownedAuthorizationSession("cash_game")]],
		[player, playerRows],
		[sessionEvent, []],
	]);
}

describe("sessionTablePlayer ownership error uniformity", () => {
	it("uses the same FORBIDDEN error for missing and foreign sessions", async () => {
		for (const sessions of [
			[],
			[{ ...ownedAuthorizationSession("cash_game"), userId: "other-user" }],
		]) {
			const { db } = createAuthorizationDb(new Map([[gameSession, sessions]]));
			await expect(
				authorizationCaller(db).list({ sessionId: "s1" })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this session",
			});
		}
	});

	it("uses the same FORBIDDEN error when add references a missing or foreign player", async () => {
		for (const players of [
			[],
			[{ id: "p1", userId: "other-user", name: "Other" }],
		]) {
			const { db } = createAuthorizationDb(playerAuthorizationRows(players));
			await expect(
				authorizationCaller(db).add({ sessionId: "s1", playerId: "p1" })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
		}
	});

	it("uses the same FORBIDDEN error when updateSeat references a missing or foreign player", async () => {
		for (const players of [
			[],
			[{ id: "p1", userId: "other-user", name: "Other" }],
		]) {
			const { db } = createAuthorizationDb(playerAuthorizationRows(players));
			await expect(
				authorizationCaller(db).updateSeat({
					sessionId: "s1",
					playerId: "p1",
					seatPosition: null,
				})
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
		}
	});

	it("uses the same FORBIDDEN error when remove references a missing or foreign player", async () => {
		for (const players of [
			[],
			[{ id: "p1", userId: "other-user", name: "Other" }],
		]) {
			const { db } = createAuthorizationDb(playerAuthorizationRows(players));
			await expect(
				authorizationCaller(db).remove({ sessionId: "s1", playerId: "p1" })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
		}
	});

	it("checks player ownership before reporting an invalid seat", async () => {
		const rows = playerAuthorizationRows([
			{ id: "p1", userId: "other-user", name: "Other" },
		]);
		rows.set(sessionCashDetail, [{ sessionId: "s1", tableSize: 2 }]);
		const { db } = createAuthorizationDb(rows);

		await expect(
			authorizationCaller(db).add({
				sessionId: "s1",
				playerId: "p1",
				seatPosition: 9,
			})
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this player",
		});
	});
});

describe("sessionTablePlayer temporary-player context ownership", () => {
	it("scopes cash session, ring game, and room reads to the caller", async () => {
		const session = {
			...ownedAuthorizationSession("cash_game"),
			roomId: "room-1",
		};
		const { db, whereParams } = createAuthorizationDb(
			new Map<unknown, Record<string, unknown>[]>([
				[gameSession, [session]],
				[sessionCashDetail, [{ sessionId: "s1", ringGameId: "ring-1" }]],
				[
					ringGame,
					[
						{
							id: "ring-1",
							userId: AUTH_OWNER,
							name: "1/2",
							blind1: 1,
							blind2: 2,
						},
					],
				],
				[room, [{ id: "room-1", userId: AUTH_OWNER, name: "Casino" }]],
				[sessionEvent, []],
			])
		);

		await authorizationCaller(db).addTemporary({ sessionId: "s1" });

		for (const table of [gameSession, ringGame, room]) {
			const calls = whereParams.get(table) ?? [];
			expect(calls.length).toBeGreaterThan(0);
			expect(calls.every((params) => params.includes(AUTH_OWNER))).toBe(true);
		}
	});

	it("scopes a tournament context read through its owning room", async () => {
		const session = {
			...ownedAuthorizationSession("tournament"),
			roomId: "room-1",
		};
		const { db, joinParams } = createAuthorizationDb(
			new Map<unknown, Record<string, unknown>[]>([
				[gameSession, [session]],
				[
					sessionTournamentDetail,
					[{ sessionId: "s1", tournamentId: "tournament-1" }],
				],
				[tournament, [{ id: "tournament-1", roomId: "room-1", name: "Main" }]],
				[room, [{ id: "room-1", userId: AUTH_OWNER, name: "Casino" }]],
				[sessionEvent, []],
			])
		);

		await authorizationCaller(db).addTemporary({ sessionId: "s1" });

		expect(
			joinParams.some(
				(join) => join.table === room && join.params.includes(AUTH_OWNER)
			)
		).toBe(true);
	});
});
