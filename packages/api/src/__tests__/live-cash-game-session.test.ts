import { currency } from "@sapphire2/db/schema/currency";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { encodeSessionCursor } from "../routers/session";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

type ChainablePromise = Promise<Rows> & Record<string, () => ChainablePromise>;

interface MockDbOptions {
	batchError?: Error;
}

function createMockDb(
	tableRows: Map<unknown, Rows>,
	options: MockDbOptions = {}
) {
	const makeResult = (table: unknown): ChainablePromise => {
		const promise = Promise.resolve(
			tableRows.get(table) ?? []
		) as ChainablePromise;
		const same = () => promise;
		for (const method of [
			"where",
			"limit",
			"orderBy",
			"groupBy",
			"innerJoin",
			"leftJoin",
		]) {
			promise[method] = same;
		}
		return promise;
	};
	return {
		select: () => ({ from: (table: unknown) => makeResult(table) }),
		insert: () => ({ values: () => Promise.resolve(undefined) }),
		update: () => ({
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
		batch: (statements: Promise<unknown>[]) => {
			if (options.batchError) {
				return Promise.reject(options.batchError);
			}
			return Promise.all(statements);
		},
	};
}

function makeCaller(
	userId: string,
	tableRows: Map<unknown, Rows>,
	options?: MockDbOptions
) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db: createMockDb(tableRows, options),
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.liveCashGameSession;
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		return;
	}
	throw new Error(`expected the call to throw ${code} but it resolved`);
}

const OWNER = "user-1";
const OTHER = "user-2";

const ownedSession = {
	id: "s1",
	userId: OWNER,
	kind: "cash_game",
	status: "active",
	source: "live",
	roomId: null,
	currencyId: null,
};

const updatedOwnedSession = { ...ownedSession, ringGameId: null };

describe("liveCashGameSession.create ownership validation (SA2-102)", () => {
	it("accepts a room and currency owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OWNER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({
				initialBuyIn: 1000,
				roomId: "room-1",
				currencyId: "cur-1",
			})
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a room owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, roomId: "room-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent room with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, roomId: "room-x" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent currency with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, currencyId: "cur-x" }),
			"FORBIDDEN"
		);
	});

	it("checks link ownership before reporting an active-session conflict", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, roomId: "room-1" })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	});

	it("does not validate ownership when room/currency are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0 })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});
});

describe("liveCashGameSession.create unfinished-session conflicts (SA2-211)", () => {
	it("returns CONFLICT when the preflight finds an unfinished live session", async () => {
		const rows = new Map<unknown, Rows>([[gameSession, [ownedSession]]]);

		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0 })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Another session is already active",
		});
	});

	it("maps the authoritative unique-index race to CONFLICT", async () => {
		const rows = new Map<unknown, Rows>([[gameSession, []]]);
		const batchError = new Error(
			"D1_ERROR: UNIQUE constraint failed: game_session.user_id: SQLITE_CONSTRAINT"
		);

		await expect(
			makeCaller(OWNER, rows, { batchError }).create({ initialBuyIn: 0 })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Another session is already active",
		});
	});

	it("does not hide unrelated batch failures", async () => {
		const rows = new Map<unknown, Rows>([[gameSession, []]]);
		const batchError = new Error("D1 unavailable");

		await expect(
			makeCaller(OWNER, rows, { batchError }).create({ initialBuyIn: 0 })
		).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
			message: batchError.message,
		});
	});
});

describe("liveCashGameSession.update ownership validation (SA2-102)", () => {
	it("accepts a room and currency owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OWNER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({
				id: "s1",
				roomId: "room-1",
				currencyId: "cur-1",
			})
		).resolves.toEqual(updatedOwnedSession);
	});

	it("rejects a room owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", roomId: "room-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent room with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", roomId: "room-x" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent currency with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", currencyId: "cur-x" }),
			"FORBIDDEN"
		);
	});

	it("clears roomId/currencyId with null without an ownership error", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({
				id: "s1",
				roomId: null,
				currencyId: null,
			})
		).resolves.toEqual(updatedOwnedSession);
	});

	it("does not validate ownership when room/currency are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", memo: "note" })
		).resolves.toEqual(updatedOwnedSession);
	});
});

describe("liveCashGameSession.create ring game ownership (SA2-181)", () => {
	it("accepts a ring game owned by the caller via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: "room-1",
						userId: OWNER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 1000, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("accepts a null-roomId auto-generated ring game owned via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: null,
						userId: OWNER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 1000, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a ring game owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: "room-1",
						userId: OTHER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a legacy ring game with null userId with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: null,
						userId: null,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent ring game with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[ringGame, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-x" }),
			"FORBIDDEN"
		);
	});
});

describe("liveCashGameSession.create initial buy-in bounds against the ring game (SA2-148)", () => {
	const boundedRingGame = {
		id: "rg-1",
		roomId: null,
		userId: OWNER,
		minBuyIn: 40,
		maxBuyIn: 200,
	};

	it("rejects an initialBuyIn below the ring game's minBuyIn with BAD_REQUEST", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[ringGame, [boundedRingGame]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 39, ringGameId: "rg-1" })
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "Initial buy-in must be at least 40",
		});
	});

	it("rejects an initialBuyIn above the ring game's maxBuyIn with BAD_REQUEST", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[ringGame, [boundedRingGame]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 201, ringGameId: "rg-1" })
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message: "Initial buy-in must be at most 200",
		});
	});

	it("accepts an initialBuyIn within the ring game's bounds", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[ringGame, [boundedRingGame]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 40, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});
});

describe("liveCashGameSession.update ring game ownership (SA2-181)", () => {
	it("accepts a ring game owned by the caller via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", userId: OWNER, currencyId: null }],
			],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" })
		).resolves.toEqual(updatedOwnedSession);
	});

	it("accepts a null-roomId auto-generated ring game owned via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: OWNER, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" })
		).resolves.toEqual(updatedOwnedSession);
	});

	it("rejects a ring game owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", userId: OTHER, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a legacy ring game with null userId with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: null, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent ring game with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, []],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-x" }),
			"FORBIDDEN"
		);
	});

	it("clears ringGameId with null without an ownership error", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: OWNER, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: null })
		).resolves.toEqual(updatedOwnedSession);
	});
});

describe("liveCashGameSession router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveCashGameSession).sort()).toEqual(
			[
				"complete",
				"create",
				"createAndAssignRingGame",
				"discard",
				"getById",
				"list",
				"reopen",
				"update",
				"updateHeroSeat",
				"updateSnapshot",
			].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.liveCashGameSession, {
			complete: "mutation",
			create: "mutation",
			createAndAssignRingGame: "mutation",
			discard: "mutation",
			getById: "query",
			list: "query",
			reopen: "mutation",
			update: "mutation",
			updateHeroSeat: "mutation",
			updateSnapshot: "mutation",
		});
	});
});

describe("liveCashGameSession.create input validation (initialBuyIn, SA2-148)", () => {
	it("initialBuyIn accepts zero and rejects negative or fractional values", () => {
		expectAccepts(appRouter.liveCashGameSession.create, { initialBuyIn: 0 });
		expectRejects(appRouter.liveCashGameSession.create, { initialBuyIn: -1 });
		expectRejects(appRouter.liveCashGameSession.create, { initialBuyIn: 1.5 });
	});
});

describe("liveCashGameSession.createAndAssignRingGame authorization", () => {
	const payload = {
		sessionId: "s1",
		roomId: "room-1",
		name: "1/2",
	};

	it("rejects a live cash session owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [{ ...ownedSession, userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).createAndAssignRingGame(payload)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this live cash game session",
		});
	});

	it("uses the same ownership error when the live cash session is missing", async () => {
		const rows = new Map<unknown, Rows>([[gameSession, []]]);
		await expect(
			makeCaller(OWNER, rows).createAndAssignRingGame(payload)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this live cash game session",
		});
	});

	it("rejects non-cash and non-live sessions before writing", async () => {
		for (const session of [
			{ ...ownedSession, kind: "tournament" },
			{ ...ownedSession, source: "manual" },
		]) {
			const rows = new Map<unknown, Rows>([[gameSession, [session]]]);
			await expectTrpcCode(
				makeCaller(OWNER, rows).createAndAssignRingGame(payload),
				"FORBIDDEN"
			);
		}
	});

	it("rejects a room owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignRingGame(payload),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignRingGame({
				...payload,
				currencyId: "cur-1",
			}),
			"FORBIDDEN"
		);
	});

	it("rejects assigning a new master from a different room than the session", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [{ ...ownedSession, roomId: "room-existing" }]],
			[room, [{ id: "room-1", userId: OWNER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignRingGame(payload),
			"BAD_REQUEST"
		);
	});
});

describe("liveCashGameSession.list input validation", () => {
	it("accepts empty object (limit defaults to 20)", () => {
		const schema = getInputSchema(appRouter.liveCashGameSession.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { limit: number };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.limit).toBe(20);
	});

	it("accepts all valid status values", () => {
		for (const status of ["active", "paused", "completed"] as const) {
			expectAccepts(appRouter.liveCashGameSession.list, { status });
		}
	});

	it("rejects unknown status", () => {
		expectRejects(appRouter.liveCashGameSession.list, { status: "ended" });
	});

	it("limit accepts 1..100 and rejects 0, 101, and fractional values", () => {
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 1 });
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 100 });
		expectRejects(appRouter.liveCashGameSession.list, { limit: 0 });
		expectRejects(appRouter.liveCashGameSession.list, { limit: 101 });
		expectRejects(appRouter.liveCashGameSession.list, { limit: 10.5 });
	});
});

describe("liveCashGameSession.complete input validation", () => {
	it("finalStack accepts zero and rejects negative or fractional values", () => {
		expectAccepts(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 0,
		});
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: -1,
		});
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 1.5,
		});
	});
});

describe("liveCashGameSession.updateHeroSeat input validation", () => {
	it("heroSeatPosition accepts 0..9 and null and rejects -1 and 10", () => {
		for (const heroSeatPosition of [0, 8, 9, null]) {
			expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
				id: "s1",
				heroSeatPosition,
			});
		}
		for (const heroSeatPosition of [-1, 10]) {
			expectRejects(appRouter.liveCashGameSession.updateHeroSeat, {
				id: "s1",
				heroSeatPosition,
			});
		}
	});
});

describe("liveCashGameSession.updateSnapshot input validation", () => {
	it("rejects an empty ruleName", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			ruleName: "",
		});
	});

	it("rejects an unknown anteType value", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			anteType: "weird",
		});
	});

	it.each([
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const)("%s accepts zero, the safe maximum, and null and rejects negative, fractional, and unsafe values", (field) => {
		for (const value of [0, Number.MAX_SAFE_INTEGER, null]) {
			expectAccepts(appRouter.liveCashGameSession.updateSnapshot, {
				id: "s1",
				[field]: value,
			});
		}
		for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
			expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
				id: "s1",
				[field]: value,
			});
		}
	});

	it("restricts tableSize to 2..10 while accepting null", () => {
		for (const tableSize of [2, 10, null]) {
			expectAccepts(appRouter.liveCashGameSession.updateSnapshot, {
				id: "s1",
				tableSize,
			});
		}
		for (const tableSize of [1, 11, 2.5]) {
			expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
				id: "s1",
				tableSize,
			});
		}
	});
});

const dialect = new SQLiteSyncDialect();

type ChainableAny = Promise<Rows> &
	Record<string, (...args: unknown[]) => ChainableAny>;

function createListMockDb(listRows: Rows = []) {
	const listWhere: { params: unknown[]; sql: string }[] = [];
	const listOrderBy: string[] = [];
	const listJoins: { params: unknown[]; table: unknown }[] = [];
	const makeChain = (rows: Rows, isList: boolean): ChainableAny => {
		const chain = Promise.resolve(rows) as ChainableAny;
		chain.from = (table: unknown) => {
			const list = table === gameSession;
			return makeChain(list ? listRows : [], list);
		};
		chain.where = (cond: unknown) => {
			if (isList) {
				const q = dialect.sqlToQuery(cond as never);
				listWhere.push({ sql: q.sql, params: q.params });
			}
			return chain;
		};
		chain.orderBy = (...cols: unknown[]) => {
			if (isList) {
				listOrderBy.push(
					cols.map((c) => dialect.sqlToQuery(c as never).sql).join(", ")
				);
			}
			return chain;
		};
		chain.limit = () => chain;
		chain.leftJoin = (table: unknown, condition: unknown) => {
			if (isList && (table === room || table === currency)) {
				listJoins.push({
					table,
					params: dialect.sqlToQuery(condition as never).params,
				});
			}
			return chain;
		};
		chain.innerJoin = () => chain;
		return chain;
	};
	const db = { select: () => makeChain([], false) };
	return { db, listJoins, listOrderBy, listWhere };
}

function listCaller(db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: OWNER } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.liveCashGameSession;
}

interface CursorRow {
	id: string;
	sessionDate: Date;
	startedAt: Date | null;
}

function makeCashRows(n: number): Rows {
	return Array.from({ length: n }, (_, i) => ({
		id: `s${i}`,
		userId: OWNER,
		status: "active",
		startedAt: new Date((i + 1) * 1_000_000),
		sessionDate: new Date((i + 1) * 1_000_000),
	}));
}

describe("liveCashGameSession.list status filter", () => {
	it.each([
		"active",
		"paused",
		"completed",
	] as const)("scopes the query to status %s when provided", async (status) => {
		const { db, listWhere } = createListMockDb();
		await listCaller(db).list({ status, limit: 10 });
		const base = listWhere[0];
		expect(base?.sql.toLowerCase()).toContain('"status"');
		expect(base?.params).toContain(status);
	});
});

describe("liveCashGameSession.list composite keyset cursor (SA2-150)", () => {
	it("scopes room and currency joins to the caller", async () => {
		const { db, listJoins } = createListMockDb();
		await listCaller(db).list({ limit: 10 });

		expect(listJoins).toHaveLength(2);
		expect(listJoins.map((join) => join.table)).toEqual([room, currency]);
		expect(listJoins.map((join) => join.params)).toEqual([[OWNER], [OWNER]]);
	});

	it("orders by the coalesced start key then id descending (stable tiebreak)", async () => {
		const { db, listOrderBy } = createListMockDb();
		await listCaller(db).list({ limit: 10 });
		expect(listOrderBy).toHaveLength(1);
		const order = listOrderBy[0]?.toLowerCase() ?? "";
		expect(order).toContain("coalesce");
		expect(order).toContain('"game_session"."id" desc');
	});

	it("adds no keyset condition when no cursor is supplied", async () => {
		const { db, listWhere } = createListMockDb();
		await listCaller(db).list({ limit: 10 });
		const base = listWhere[0];
		expect(base).toBeDefined();
		expect(base?.params.filter((p) => p === OWNER)).toHaveLength(1);
		expect(base?.sql.toLowerCase()).not.toContain("coalesce");
	});

	it("treats a malformed cursor as no cursor (does not filter every row out)", async () => {
		const { db, listWhere } = createListMockDb();
		await listCaller(db).list({ cursor: "no-separator", limit: 10 });
		const base = listWhere[0];
		expect(base?.params).not.toContain("no-separator");
		expect(base?.params.filter((p) => p === OWNER)).toHaveLength(1);
		expect(base?.sql.toLowerCase()).not.toContain("coalesce");
	});

	it("embeds the cursor's (timestamp, id) as a keyset, not a subquery on the id", async () => {
		const { db, listWhere } = createListMockDb();
		const cursor = encodeSessionCursor({
			id: "cur-id",
			startedAt: new Date(5_000_000),
			sessionDate: new Date(5_000_000),
		});
		await listCaller(db).list({ cursor, limit: 10 });
		const where = listWhere[0];
		expect(where?.sql.toLowerCase()).not.toContain("select");
		expect(where?.params.filter((p) => p === 5000)).toHaveLength(2);
		expect(where?.params).toContain("cur-id");
		expect(where?.params).not.toContain(cursor);
	});

	it("keeps paginating from the same keyset even when the cursor row was deleted", async () => {
		const { db, listWhere } = createListMockDb(makeCashRows(2));
		const cursor = encodeSessionCursor({
			id: "deleted-id",
			startedAt: new Date(9_000_000),
			sessionDate: new Date(9_000_000),
		});
		const result = await listCaller(db).list({ cursor, limit: 10 });
		const where = listWhere[0];
		expect(where?.sql.toLowerCase()).not.toContain("select");
		expect(where?.params.filter((p) => p === 9000)).toHaveLength(2);
		expect(where?.params).toContain("deleted-id");
		expect(result.items).toHaveLength(2);
	});

	it("returns nextCursor as the last kept row's composite value when more rows exist", async () => {
		const rows = makeCashRows(3);
		const { db } = createListMockDb(rows);
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBe(
			encodeSessionCursor(rows[1] as unknown as CursorRow)
		);
	});

	it("returns no nextCursor at exactly the page-size boundary", async () => {
		const { db } = createListMockDb(makeCashRows(2));
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBeUndefined();
	});

	it("returns no nextCursor for a partial single page", async () => {
		const { db } = createListMockDb(makeCashRows(1));
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(1);
		expect(result.nextCursor).toBeUndefined();
	});

	it("returns empty items and no nextCursor when there are no sessions", async () => {
		const { db } = createListMockDb([]);
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeUndefined();
	});
});

function sessionEventRow(
	sessionId: string,
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt: number,
	sortOrder: number
): Record<string, unknown> {
	return {
		sessionId,
		eventType,
		payload: JSON.stringify(payload),
		occurredAt: new Date(occurredAt),
		sortOrder,
	};
}

function createEventBatchMockDb(sessions: Rows, events: Rows) {
	const fromCalls: unknown[] = [];
	const eventWhere: unknown[] = [];
	const makeChain = (table: unknown) => {
		const rows = table === sessionEvent ? events : sessions;
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.where = (cond: unknown) => {
			if (table === sessionEvent) {
				eventWhere.push(cond);
			}
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		chain.groupBy = () => chain;
		return chain;
	};
	const db = {
		select: () => ({
			from: (table: unknown) => {
				fromCalls.push(table);
				return makeChain(table);
			},
		}),
	};
	return { db, fromCalls, eventWhere };
}

function sessionEventFromCount(fromCalls: unknown[]): number {
	return fromCalls.filter((t) => t === sessionEvent).length;
}

describe("liveCashGameSession.list event batching (SA2-151)", () => {
	it("fetches the whole page's events in a single inArray query, not one per session", async () => {
		const sessions: Rows = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
		const events: Rows = [
			sessionEventRow("s1", "session_start", { buyInAmount: 100 }, 1000, 0),
			sessionEventRow("s2", "session_start", { buyInAmount: 200 }, 1000, 0),
		];
		const { db, fromCalls, eventWhere } = createEventBatchMockDb(
			sessions,
			events
		);

		const result = await listCaller(db).list({ limit: 20 });

		expect(sessionEventFromCount(fromCalls)).toBe(1);
		const query = dialect.sqlToQuery(eventWhere[0] as never);
		expect(query.sql).toContain("in (");
		expect(query.params).toEqual(["s1", "s2", "s3"]);
		expect(result.items).toHaveLength(3);
	});

	it("buckets events by session id so each item counts only its own events", async () => {
		const sessions: Rows = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
		const events: Rows = [
			sessionEventRow("s1", "session_start", { buyInAmount: 100 }, 1000, 0),
			sessionEventRow("s1", "update_stack", { stackAmount: 500 }, 2000, 1),
			sessionEventRow("s1", "update_stack", { stackAmount: 800 }, 3000, 2),
			sessionEventRow("s2", "session_start", { buyInAmount: 200 }, 1000, 0),
			sessionEventRow("s2", "update_stack", { stackAmount: 1200 }, 9000, 1),
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });
		const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

		expect(byId.s1?.eventCount).toBe(3);
		expect(byId.s1?.latestStackAmount).toBe(800);
		expect(byId.s2?.eventCount).toBe(2);
		expect(byId.s2?.latestStackAmount).toBe(1200);
		expect(byId.s3?.eventCount).toBe(0);
		expect(byId.s3?.latestStackAmount).toBeNull();
	});

	it("derives the latest stack from (occurredAt, sortOrder) order, not array order", async () => {
		const sessions: Rows = [{ id: "s1" }];
		const events: Rows = [
			sessionEventRow("s1", "update_stack", { stackAmount: 300 }, 3000, 1),
			sessionEventRow("s1", "update_stack", { stackAmount: 100 }, 1000, 1),
			sessionEventRow("s1", "update_stack", { stackAmount: 200 }, 2000, 1),
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items[0]?.latestStackAmount).toBe(300);
	});

	it("breaks occurredAt ties by sortOrder when picking the latest stack", async () => {
		const sessions: Rows = [{ id: "s1" }];
		const events: Rows = [
			sessionEventRow("s1", "update_stack", { stackAmount: 111 }, 5000, 2),
			sessionEventRow("s1", "update_stack", { stackAmount: 222 }, 5000, 1),
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items[0]?.latestStackAmount).toBe(111);
	});

	it("batches once and derives the stack for a single-session page", async () => {
		const sessions: Rows = [{ id: "only" }];
		const events: Rows = [
			sessionEventRow("only", "session_start", { buyInAmount: 500 }, 1000, 0),
			sessionEventRow("only", "update_stack", { stackAmount: 750 }, 2000, 1),
		];
		const { db, fromCalls } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(sessionEventFromCount(fromCalls)).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.eventCount).toBe(2);
		expect(result.items[0]?.latestStackAmount).toBe(750);
	});

	it("returns null latest stack when a session has only non-stack events", async () => {
		const sessions: Rows = [{ id: "s1" }];
		const events: Rows = [
			sessionEventRow("s1", "session_start", { buyInAmount: 400 }, 1000, 0),
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items[0]?.eventCount).toBe(1);
		expect(result.items[0]?.latestStackAmount).toBeNull();
	});

	it("issues no event query and returns no items for an empty page", async () => {
		const { db, fromCalls } = createEventBatchMockDb([], []);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeUndefined();
		expect(sessionEventFromCount(fromCalls)).toBe(0);
	});
});

describe("liveCashGameSession.getById event summary (SA2-211)", () => {
	function sessionEventFixture(
		eventType: string,
		payload: Record<string, unknown>
	): Record<string, unknown> {
		return { eventType, payload: JSON.stringify(payload) };
	}

	it("computes buy-in, addon count, running stack range, and cash-out from the events", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[sessionCashDetail, []],
			[
				sessionEvent,
				[
					sessionEventFixture("session_start", { buyInAmount: 100 }),
					sessionEventFixture("chips_add_remove", { amount: 50 }),
					sessionEventFixture("update_stack", { stackAmount: 500 }),
					sessionEventFixture("update_stack", { stackAmount: 600 }),
					sessionEventFixture("session_end", { cashOutAmount: 1200 }),
				],
			],
		]);

		const result = await makeCaller(OWNER, rows).getById({ id: "s1" });

		expect(result.summary).toMatchObject({
			totalBuyIn: 150,
			addonCount: 1,
			currentStack: 600,
			maxStack: 600,
			minStack: 500,
			cashOut: 1200,
		});
	});

	it("does not count a non-positive chips_add_remove amount as a buy-in or addon", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[sessionCashDetail, []],
			[
				sessionEvent,
				[
					sessionEventFixture("session_start", { buyInAmount: 100 }),
					sessionEventFixture("chips_add_remove", { amount: -30 }),
				],
			],
		]);

		const result = await makeCaller(OWNER, rows).getById({ id: "s1" });

		expect(result.summary).toMatchObject({ totalBuyIn: 100, addonCount: 0 });
	});

	it("tracks the running max and min stack across multiple update_stack events", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[sessionCashDetail, []],
			[
				sessionEvent,
				[
					sessionEventFixture("update_stack", { stackAmount: 500 }),
					sessionEventFixture("update_stack", { stackAmount: 300 }),
					sessionEventFixture("update_stack", { stackAmount: 900 }),
				],
			],
		]);

		const result = await makeCaller(OWNER, rows).getById({ id: "s1" });

		expect(result.summary).toMatchObject({
			maxStack: 900,
			minStack: 300,
			currentStack: 900,
		});
	});
});

describe("liveCashGameSession.updateSnapshot mixGames", () => {
	const validMix = [
		{ name: "Big Bet", variants: ["NL Hold'em", "Pot Limit Omaha"] },
	];

	function callerCapturingSnapshotUpdate(detail: Record<string, unknown>) {
		const updates: Record<string, unknown>[] = [];
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[sessionCashDetail, [detail]],
			[gameMix, []],
			[
				gameVariant,
				[
					{ id: "variant-1", userId: OWNER, label: "NL Hold'em" },
					{
						id: "variant-2",
						userId: OWNER,
						label: "Pot Limit Omaha",
					},
				],
			],
		]);
		const baseDb = createMockDb(rows);
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db: {
				...baseDb,
				update: () => ({
					set: (value: Record<string, unknown>) => {
						updates.push(value);
						return { where: () => Promise.resolve(undefined) };
					},
				}),
			},
		} as unknown as Parameters<
			typeof appRouter.createCaller
		>[0]).liveCashGameSession;
		return { caller, updates };
	}

	it("accepts an explicit null to clear the mix definition", () => {
		expectAccepts(appRouter.liveCashGameSession.updateSnapshot, {
			id: "session-1",
			mixGames: null,
		});
	});

	it("rejects a mix totalling fewer than two games", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "session-1",
			mixGames: [{ variants: ["nlh"] }],
		});
	});

	it("clears frozen mixGames when the snapshot variant changes to a plain game", async () => {
		const { caller, updates } = callerCapturingSnapshotUpdate({
			sessionId: "s1",
			variant: "8-Game",
			mixGames: validMix,
		});

		await caller.updateSnapshot({ id: "s1", variant: "NL Hold'em" });

		expect(updates).toHaveLength(1);
		expect(updates[0]).toMatchObject({
			variant: "NL Hold'em",
			mixGames: null,
		});
	});

	it("rejects mixGames on an existing plain snapshot", async () => {
		const { caller, updates } = callerCapturingSnapshotUpdate({
			sessionId: "s1",
			variant: "NL Hold'em",
			mixGames: null,
		});

		await expect(
			caller.updateSnapshot({ id: "s1", mixGames: validMix })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(updates).toEqual([]);
	});

	it("clears stale flat blind and ante fields when changing to a mix", async () => {
		const { caller, updates } = callerCapturingSnapshotUpdate({
			sessionId: "s1",
			variant: "NL Hold'em",
			mixGames: null,
			blind1: 10,
			blind2: 20,
			blind3: 40,
			ante: 5,
			anteType: "all",
		});

		await caller.updateSnapshot({
			id: "s1",
			variant: "mix",
			mixGames: validMix,
		});

		expect(updates[0]).toMatchObject({
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
		});
	});
});
