import { room } from "@sapphire2/db/schema/room";
import {
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
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
 * can assert the WHERE predicate is scoped to the owned tournament (SA2-123).
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
	} as unknown as Parameters<
		typeof appRouter.createCaller
	>[0]).tournamentChipPurchase;
	return { caller, updateWhereParams };
}

const CALLER = "user-1";
const OTHER = "user-2";

describe("tournamentChipPurchase router structure", () => {
	it("appRouter has tournamentChipPurchase namespace", () => {
		expect(appRouter.tournamentChipPurchase).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournamentChipPurchase).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("listByTournament is a protected query", () => {
		expectProtected(appRouter.tournamentChipPurchase.listByTournament);
		expectType(appRouter.tournamentChipPurchase.listByTournament, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of ["create", "update", "delete", "reorder"] as const) {
			const proc = appRouter.tournamentChipPurchase[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("tournamentChipPurchase.listByTournament input validation", () => {
	it("accepts valid tournamentId", () => {
		expectAccepts(appRouter.tournamentChipPurchase.listByTournament, {
			tournamentId: "tn1",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.listByTournament, {});
	});
});

describe("tournamentChipPurchase.create input validation", () => {
	const valid = {
		tournamentId: "tn1",
		name: "Rebuy",
		cost: 100,
		chips: 10_000,
	};

	it("accepts a valid creation payload", () => {
		expectAccepts(appRouter.tournamentChipPurchase.create, valid);
	});

	it("accepts cost=0 and chips=0 (free add-on edge case)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: 0,
			chips: 0,
		});
	});

	it("accepts negative cost (correction) — schema is permissive", () => {
		// The schema uses z.number().int() without a min; runtime-level business
		// validation would live elsewhere. We pin this to prevent silent
		// tightening.
		expectAccepts(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: -50,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			name: "",
		});
	});

	it("rejects non-integer cost", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: 12.5,
		});
	});

	it("rejects non-integer chips", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			chips: 100.5,
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		});
	});
});

describe("tournamentChipPurchase.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.update, { id: "cp1" });
	});

	it("accepts all optional fields together", () => {
		expectAccepts(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			name: "Rebuy-2",
			cost: 150,
			chips: 12_000,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			name: "",
		});
	});

	it("rejects non-integer chips", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			chips: 1.5,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, { chips: 100 });
	});
});

describe("tournamentChipPurchase.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.tournamentChipPurchase.delete, { id: "cp1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournamentChipPurchase.delete, {});
	});
});

describe("tournamentChipPurchase.reorder input validation", () => {
	it("accepts a tournamentId and array of ids (including empty)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: [],
		});
		expectAccepts(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: ["cp1", "cp2", "cp3"],
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			ids: ["cp1"],
		});
	});

	it("rejects non-array ids", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: "cp1",
		});
	});

	it("rejects non-string id entries", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: ["cp1", 42],
		});
	});
});

describe("tournamentChipPurchase.reorder tournament scoping (SA2-123)", () => {
	function ownedRows() {
		return new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: CALLER }]],
			[tournamentChipPurchase, [{ id: "cp1", sortOrder: 0 }]],
		]);
	}

	it("scopes each UPDATE to both the row id and the owned tournament", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", ids: ["cp1", "cp2"] });
		expect(updateWhereParams).toHaveLength(2);
		expect(updateWhereParams[0]).toContain("cp1");
		expect(updateWhereParams[0]).toContain("tn1");
		expect(updateWhereParams[1]).toContain("cp2");
		expect(updateWhereParams[1]).toContain("tn1");
	});

	it("runs no UPDATE when ids is empty", async () => {
		const { caller, updateWhereParams } = makeCaller(CALLER, ownedRows());
		await caller.reorder({ tournamentId: "tn1", ids: [] });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("throws FORBIDDEN and runs no UPDATE when the tournament is owned by another user", async () => {
		const rows = new Map<unknown, Rows>([
			[tournament, [{ id: "tn1", roomId: "room1" }]],
			[room, [{ id: "room1", userId: OTHER }]],
			[tournamentChipPurchase, []],
		]);
		const { caller, updateWhereParams } = makeCaller(CALLER, rows);
		await expectTrpcCode(
			caller.reorder({ tournamentId: "tn1", ids: ["cp1"] }),
			"FORBIDDEN"
		);
		expect(updateWhereParams).toHaveLength(0);
	});
});
