import { item, itemTransaction } from "@sapphire2/db/schema/item";
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

function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const selectWhereParams: unknown[][] = [];
	const inserted: { table: unknown; values: unknown }[] = [];
	const deleted: { table: unknown }[] = [];
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = (cond: unknown) => {
			selectWhereParams.push(dialect.sqlToQuery(cond as never).params);
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.innerJoin = () => chain;
		chain.leftJoin = () => chain;
		return chain;
	};
	const db = {
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
		delete: (table: unknown) => {
			deleted.push({ table });
			return { where: () => Promise.resolve(undefined) };
		},
	};
	return { db, inserted, deleted, selectWhereParams };
}

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, inserted, deleted, selectWhereParams } =
		createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).itemTransaction;
	return { caller, inserted, deleted, selectWhereParams };
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

describe("itemTransaction router structure", () => {
	it("appRouter has itemTransaction namespace", () => {
		expect(appRouter.itemTransaction).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.itemTransaction).sort()).toEqual(
			["create", "delete", "listByItem", "update"].sort()
		);
	});

	it("listByItem is a protected query", () => {
		expectProtected(appRouter.itemTransaction.listByItem);
		expectType(appRouter.itemTransaction.listByItem, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.itemTransaction.create,
			appRouter.itemTransaction.update,
			appRouter.itemTransaction.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("itemTransaction.create input validation", () => {
	const valid = { itemId: "i1", count: 2, transactedAt: "2024-01-01" };

	it("accepts a positive count (items gained)", () => {
		expectAccepts(appRouter.itemTransaction.create, valid);
	});

	it("accepts a negative count (items spent)", () => {
		expectAccepts(appRouter.itemTransaction.create, { ...valid, count: -3 });
	});

	it("accepts an optional memo", () => {
		expectAccepts(appRouter.itemTransaction.create, {
			...valid,
			memo: "satellite win",
		});
	});

	it("rejects count 0 (no-op row)", () => {
		expectRejects(appRouter.itemTransaction.create, { ...valid, count: 0 });
	});

	it("rejects non-integer count", () => {
		expectRejects(appRouter.itemTransaction.create, { ...valid, count: 1.5 });
	});

	it("rejects missing itemId", () => {
		expectRejects(appRouter.itemTransaction.create, {
			count: 1,
			transactedAt: "2024-01-01",
		});
	});

	it.each([
		["an arbitrary string", "not-a-date"],
		["an impossible calendar date", "2024-02-30"],
		["a timestamp instead of a date-only value", "2024-02-02T00:00:00Z"],
	])("rejects transactedAt as %s", (_scenario, transactedAt) => {
		expectRejects(appRouter.itemTransaction.create, {
			...valid,
			transactedAt,
		});
	});
});

describe("itemTransaction.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.itemTransaction.update, { id: "itx1" });
	});

	it("accepts partial updates", () => {
		expectAccepts(appRouter.itemTransaction.update, { id: "itx1", count: -1 });
		expectAccepts(appRouter.itemTransaction.update, {
			id: "itx1",
			transactedAt: "2024-06-01",
		});
		expectAccepts(appRouter.itemTransaction.update, {
			id: "itx1",
			memo: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.itemTransaction.update, { count: 1 });
	});

	it("rejects count 0 when provided", () => {
		expectRejects(appRouter.itemTransaction.update, { id: "itx1", count: 0 });
	});

	it("rejects non-integer count when provided", () => {
		expectRejects(appRouter.itemTransaction.update, {
			id: "itx1",
			count: 2.5,
		});
	});
});

describe("itemTransaction.listByItem ownership", () => {
	it("rejects a foreign item with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OTHER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.listByItem({ itemId: "i1" }), "FORBIDDEN");
	});

	it("returns the same FORBIDDEN code when the item does not exist", async () => {
		const rows = new Map<unknown, Rows>([[item, []]]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.listByItem({ itemId: "i1" }), "FORBIDDEN");
	});

	it("lists transactions for an owned item", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[
				itemTransaction,
				[
					{
						id: "itx1",
						itemId: "i1",
						sessionId: null,
						count: 2,
						transactedAt: new Date("2024-01-01T00:00:00Z"),
						memo: null,
						createdAt: new Date("2024-01-01T00:00:00Z"),
					},
				],
			],
		]);
		const { caller } = makeCaller(OWNER, rows);
		const result = await caller.listByItem({ itemId: "i1" });
		expect(result.items).toHaveLength(1);
		expect(result.nextCursor).toBeUndefined();
	});

	it("scopes the cursor lookup to the queried item (ownership-scoped keyset)", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[itemTransaction, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);
		await caller.listByItem({ itemId: "i1", cursor: "itx9" });
		const cursorLookup = selectWhereParams.find(
			(params) => params.includes("itx9") && params.includes("i1")
		);
		expect(cursorLookup).toBeDefined();
	});
});

describe("itemTransaction.create ownership", () => {
	const valid = { itemId: "i1", count: 2, transactedAt: "2024-01-01" };

	it("creates a manual transaction for an owned item", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[itemTransaction, [{ id: "itx-new" }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(caller.create(valid)).resolves.toBeDefined();
		const insertedRow = inserted[0]?.values as Record<string, unknown>;
		expect(insertedRow.itemId).toBe("i1");
		expect(insertedRow.count).toBe(2);
		expect(insertedRow.sessionId).toBeUndefined();
	});

	it("rejects a foreign item with FORBIDDEN and skips the insert", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OTHER }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(valid), "FORBIDDEN");
		expect(inserted).toHaveLength(0);
	});
});

describe("itemTransaction.update / delete immutability of session-generated rows", () => {
	function ledgerRow(sessionId: string | null, owner: string) {
		return new Map<unknown, Rows>([
			[
				itemTransaction,
				[
					{
						itemTransaction: { id: "itx1", itemId: "i1", sessionId },
						item: { id: "i1", userId: owner },
					},
				],
			],
		]);
	}

	it("updates a manual row owned by the caller", async () => {
		const { caller } = makeCaller(OWNER, ledgerRow(null, OWNER));
		await expect(
			caller.update({ id: "itx1", count: 5 })
		).resolves.toBeDefined();
	});

	it("rejects updating a session-generated row with FORBIDDEN", async () => {
		const { caller } = makeCaller(OWNER, ledgerRow("session-1", OWNER));
		await expectTrpcCode(caller.update({ id: "itx1", count: 5 }), "FORBIDDEN");
	});

	it("rejects updating a foreign row with FORBIDDEN", async () => {
		const { caller } = makeCaller(OWNER, ledgerRow(null, OTHER));
		await expectTrpcCode(caller.update({ id: "itx1", count: 5 }), "FORBIDDEN");
	});

	it("deletes a manual row owned by the caller", async () => {
		const { caller, deleted } = makeCaller(OWNER, ledgerRow(null, OWNER));
		await expect(caller.delete({ id: "itx1" })).resolves.toEqual({
			success: true,
		});
		expect(deleted).toHaveLength(1);
	});

	it("rejects deleting a session-generated row with FORBIDDEN", async () => {
		const { caller, deleted } = makeCaller(
			OWNER,
			ledgerRow("session-1", OWNER)
		);
		await expectTrpcCode(caller.delete({ id: "itx1" }), "FORBIDDEN");
		expect(deleted).toHaveLength(0);
	});

	it("rejects deleting a foreign row with FORBIDDEN", async () => {
		const { caller, deleted } = makeCaller(OWNER, ledgerRow(null, OTHER));
		await expectTrpcCode(caller.delete({ id: "itx1" }), "FORBIDDEN");
		expect(deleted).toHaveLength(0);
	});
});
