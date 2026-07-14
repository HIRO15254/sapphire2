import { room } from "@sapphire2/db/schema/room";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

type Rows = Record<string, unknown>[];
const dialect = new SQLiteSyncDialect();

function makeSelectChain(rows: Rows) {
	const chain = Promise.resolve(rows) as Promise<Rows> &
		Record<string, () => unknown>;
	chain.where = () => chain;
	chain.orderBy = () => chain;
	chain.limit = () => chain;
	return chain;
}

/**
 * Mock db that resolves `select().from(table)` from a table-keyed map and
 * records the SQL params bound to each `update().set().where(cond)` so tests
 * can assert the WHERE predicate is scoped to the owned tournament (SA2-176).
 */
function createReorderMockDb(rowsByTable: Map<unknown, Rows>) {
	const updateWhereParams: unknown[][] = [];
	const db = {
		select: () => ({
			from: (table: unknown) => makeSelectChain(rowsByTable.get(table) ?? []),
		}),
		update: () => ({
			set: () => ({
				where: (cond: unknown) => {
					updateWhereParams.push(dialect.sqlToQuery(cond as never).params);
					return Promise.resolve(undefined);
				},
			}),
		}),
	};
	return { db, updateWhereParams };
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

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, updateWhereParams } = createReorderMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).blindLevel;
	return { caller, updateWhereParams };
}

const CALLER = "user-1";
const OTHER = "user-2";

describe("blindLevel router", () => {
	it("appRouter has blindLevel namespace", () => {
		expect(appRouter.blindLevel).toBeDefined();
	});

	it("has listByTournament procedure", () => {
		expect(appRouter.blindLevel.listByTournament).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.blindLevel.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.blindLevel.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.blindLevel.delete).toBeDefined();
	});

	it("has reorder procedure", () => {
		expect(appRouter.blindLevel.reorder).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.blindLevel).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("listByTournament is a protected query", () => {
		expectProtected(appRouter.blindLevel.listByTournament);
		expectType(appRouter.blindLevel.listByTournament, "query");
	});

	it("create / update / delete / reorder are protected mutations", () => {
		for (const proc of [
			appRouter.blindLevel.create,
			appRouter.blindLevel.update,
			appRouter.blindLevel.delete,
			appRouter.blindLevel.reorder,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("blindLevel.listByTournament input validation", () => {
	it("accepts a tournamentId", () => {
		expectAccepts(appRouter.blindLevel.listByTournament, {
			tournamentId: "tn1",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.blindLevel.listByTournament, {});
	});
});

describe("blindLevel.create input validation", () => {
	it("accepts minimal valid payload (tournamentId + level)", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1,
		});
	});

	it("accepts full payload with all optional fields", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 2,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			blind3: 25,
			ante: 25,
			minutes: 20,
		});
	});

	it("rejects non-integer level", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1.5,
		});
	});

	it("rejects non-integer blind1", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "tn1",
			level: 1,
			blind1: 1.5,
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.blindLevel.create, { level: 1 });
	});

	it("rejects missing level", () => {
		expectRejects(appRouter.blindLevel.create, { tournamentId: "tn1" });
	});
});

describe("blindLevel.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.blindLevel.update, { id: "bl1" });
	});

	it("accepts nullable blind/ante/minutes fields set to null", () => {
		expectAccepts(appRouter.blindLevel.update, {
			id: "bl1",
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: null,
		});
	});

	it("accepts full field update", () => {
		expectAccepts(appRouter.blindLevel.update, {
			id: "bl1",
			level: 5,
			isBreak: true,
			blind1: 500,
			blind2: 1000,
			minutes: 15,
		});
	});

	it("rejects non-integer level", () => {
		expectRejects(appRouter.blindLevel.update, { id: "bl1", level: 1.5 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.blindLevel.update, { level: 1 });
	});
});

describe("blindLevel.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.blindLevel.delete, { id: "bl1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.blindLevel.delete, {});
	});
});

describe("blindLevel.reorder input validation", () => {
	it("accepts tournamentId + array of levelIds (empty allowed)", () => {
		expectAccepts(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: [],
		});
		expectAccepts(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: ["bl1", "bl2", "bl3"],
		});
	});

	it("rejects missing levelIds", () => {
		expectRejects(appRouter.blindLevel.reorder, { tournamentId: "tn1" });
	});

	it("rejects non-string entries in levelIds", () => {
		expectRejects(appRouter.blindLevel.reorder, {
			tournamentId: "tn1",
			levelIds: ["bl1", 2],
		});
	});
});

describe("blindLevel.reorder tournament scoping (SA2-176)", () => {
	function ownedRows() {
		return new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: CALLER }]],
			[blindLevel, [{ id: "bl1", level: 1 }]],
		]);
	}

	it("scopes each level UPDATE to both the level id and the owned tournament", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", levelIds: ["bl1", "bl2"] });
		expect(updateWhereParams).toHaveLength(2);
		// Every UPDATE must constrain the row to the caller's tournament so a
		// foreign levelId matches nothing.
		expect(updateWhereParams[0]).toContain("bl1");
		expect(updateWhereParams[0]).toContain("tn1");
		expect(updateWhereParams[1]).toContain("bl2");
		expect(updateWhereParams[1]).toContain("tn1");
	});

	it("runs no UPDATE when levelIds is empty", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", levelIds: [] });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("throws FORBIDDEN and runs no UPDATE when the tournament is owned by another user", async () => {
		const rows = new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: OTHER }]],
			[blindLevel, []],
		]);
		const { caller, updateWhereParams } = makeCaller(CALLER, rows);
		await expectTrpcCode(
			caller.reorder({ tournamentId: "tn1", levelIds: ["bl1"] }),
			"FORBIDDEN"
		);
		expect(updateWhereParams).toHaveLength(0);
	});
});

describe("blindLevel games input", () => {
	it("create accepts per-level game groups", () => {
		expectAccepts(appRouter.blindLevel.create, {
			tournamentId: "t-1",
			level: 1,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			games: [
				{ name: "Limit", variants: ["lhe", "o8"], blind1: 400, blind2: 800 },
			],
		});
	});

	it("create rejects an empty games array (null means no groups)", () => {
		expectRejects(appRouter.blindLevel.create, {
			tournamentId: "t-1",
			level: 1,
			isBreak: false,
			games: [],
		});
	});

	it("update accepts an explicit null to clear the groups", () => {
		expectAccepts(appRouter.blindLevel.update, { id: "bl-1", games: null });
	});
});
