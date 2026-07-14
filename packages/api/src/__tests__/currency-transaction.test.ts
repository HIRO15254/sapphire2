import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
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

/**
 * Mock db keyed by schema-table reference: `select().from(t)...` resolves to
 * the rows registered for `t`; every `.where(cond)` records its bound SQL
 * params (so cursor scoping can be asserted) and `insert(t).values()` records
 * the inserted payload (so a rejected ownership guard can be shown to skip the
 * write).
 */
function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const selectWhereParams: unknown[][] = [];
	const selectJoinParams: unknown[][] = [];
	const inserted: { table: unknown; values: unknown }[] = [];
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
		chain.innerJoin = (_table: unknown, cond: unknown) => {
			selectJoinParams.push(dialect.sqlToQuery(cond as never).params);
			return chain;
		};
		chain.leftJoin = chain.innerJoin;
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
		delete: () => ({ where: () => Promise.resolve(undefined) }),
	};
	return { db, inserted, selectJoinParams, selectWhereParams };
}

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, inserted, selectJoinParams, selectWhereParams } =
		createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<
		typeof appRouter.createCaller
	>[0]).currencyTransaction;
	return { caller, inserted, selectJoinParams, selectWhereParams };
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

describe("currencyTransaction router structure", () => {
	it("appRouter has currencyTransaction namespace", () => {
		expect(appRouter.currencyTransaction).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currencyTransaction).sort()).toEqual(
			["create", "delete", "listByCurrency", "update"].sort()
		);
	});

	it("listByCurrency is a protected query", () => {
		expectProtected(appRouter.currencyTransaction.listByCurrency);
		expectType(appRouter.currencyTransaction.listByCurrency, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.currencyTransaction.create,
			appRouter.currencyTransaction.update,
			appRouter.currencyTransaction.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("currencyTransaction.listByCurrency input validation", () => {
	it("accepts a currencyId without cursor", () => {
		expectAccepts(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
		});
	});

	it("accepts currencyId with cursor", () => {
		expectAccepts(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
			cursor: "tx-42",
		});
	});

	it("rejects missing currencyId", () => {
		expectRejects(appRouter.currencyTransaction.listByCurrency, {});
	});

	it("rejects non-string cursor", () => {
		expectRejects(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
			cursor: 123,
		});
	});
});

describe("currencyTransaction.create input validation", () => {
	const validInput = {
		currencyId: "c1",
		transactionTypeId: "tt1",
		amount: 1000,
		transactedAt: "2024-01-01",
	};

	it("accepts the minimal valid payload", () => {
		expectAccepts(appRouter.currencyTransaction.create, validInput);
	});

	it("accepts an optional memo string", () => {
		expectAccepts(appRouter.currencyTransaction.create, {
			...validInput,
			memo: "rebuy",
		});
	});

	it("accepts negative amounts (expense / loss)", () => {
		expectAccepts(appRouter.currencyTransaction.create, {
			...validInput,
			amount: -500,
		});
	});

	it("rejects non-integer amount", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			...validInput,
			amount: 12.5,
		});
	});

	it.each([
		["an arbitrary string", "not-a-date"],
		["an impossible calendar date", "2024-02-30"],
		["a timestamp instead of a date-only value", "2024-01-01T00:00:00Z"],
	])("rejects transactedAt as %s", (_scenario, transactedAt) => {
		expectRejects(appRouter.currencyTransaction.create, {
			...validInput,
			transactedAt,
		});
	});
	it("rejects missing currencyId", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			transactionTypeId: "tt1",
			amount: 100,
			transactedAt: "2024-01-01",
		});
	});

	it("rejects missing transactedAt", () => {
		expectRejects(appRouter.currencyTransaction.create, {
			currencyId: "c1",
			transactionTypeId: "tt1",
			amount: 100,
		});
	});
});

describe("currencyTransaction.update input validation", () => {
	it("accepts id-only payload (no-op update)", () => {
		expectAccepts(appRouter.currencyTransaction.update, { id: "tx1" });
	});

	it("accepts all optional fields set", () => {
		expectAccepts(appRouter.currencyTransaction.update, {
			id: "tx1",
			transactionTypeId: "tt2",
			amount: -200,
			transactedAt: "2024-02-02",
			memo: "adjusted",
		});
	});

	it("accepts memo: null (explicit clear)", () => {
		expectAccepts(appRouter.currencyTransaction.update, {
			id: "tx1",
			memo: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currencyTransaction.update, { amount: 100 });
	});

	it("rejects non-integer amount", () => {
		expectRejects(appRouter.currencyTransaction.update, {
			id: "tx1",
			amount: 12.34,
		});
	});
	it.each([
		["an arbitrary string", "not-a-date"],
		["an impossible calendar date", "2024-02-30"],
		["a timestamp instead of a date-only value", "2024-02-02T00:00:00Z"],
	])("rejects transactedAt as %s", (_scenario, transactedAt) => {
		expectRejects(appRouter.currencyTransaction.update, {
			id: "tx1",
			transactedAt,
		});
	});
});
describe("currencyTransaction.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currencyTransaction.delete, { id: "tx1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currencyTransaction.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currencyTransaction.delete, { id: 123 });
	});
});

describe("currencyTransaction.create transactionType ownership (SA2-179)", () => {
	const validInput = {
		currencyId: "c1",
		transactionTypeId: "tt1",
		amount: 1000,
		transactedAt: "2024-01-01",
	};

	it("accepts a transaction type owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[transactionType, [{ id: "tt1", userId: OWNER }]],
			[currencyTransaction, [{ id: "tx-new" }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expect(caller.create(validInput)).resolves.toBeDefined();
	});

	it("rejects a transaction type owned by another user and skips the insert", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[transactionType, [{ id: "tt1", userId: OTHER }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(validInput), "FORBIDDEN");
		expect(inserted.some((i) => i.table === currencyTransaction)).toBe(false);
	});

	it("returns the same FORBIDDEN code when the transaction type does not exist", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[transactionType, []],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(validInput), "FORBIDDEN");
		expect(inserted.some((i) => i.table === currencyTransaction)).toBe(false);
	});

	it("rejects before validating the transaction type when the currency is foreign", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OTHER }]],
			[transactionType, [{ id: "tt1", userId: OWNER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(validInput), "FORBIDDEN");
	});
});

describe("currencyTransaction.update transactionType ownership (SA2-179)", () => {
	function ownedTransactionRows(extra?: Map<unknown, Rows>) {
		const map = new Map<unknown, Rows>([
			[
				currencyTransaction,
				[
					{
						currencyTransaction: {
							id: "tx1",
							currencyId: "c1",
							sessionId: null,
						},
						currency: { id: "c1", userId: OWNER },
					},
				],
			],
		]);
		if (extra) {
			for (const [k, v] of extra) {
				map.set(k, v);
			}
		}
		return map;
	}

	it("accepts a transaction type owned by the caller", async () => {
		const rows = ownedTransactionRows(
			new Map<unknown, Rows>([
				[transactionType, [{ id: "tt2", userId: OWNER }]],
			])
		);
		const { caller } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "tx1", transactionTypeId: "tt2" })
		).resolves.toBeDefined();
	});

	it("rejects a transaction type owned by another user with FORBIDDEN", async () => {
		const rows = ownedTransactionRows(
			new Map<unknown, Rows>([
				[transactionType, [{ id: "tt2", userId: OTHER }]],
			])
		);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "tx1", transactionTypeId: "tt2" }),
			"FORBIDDEN"
		);
	});

	it("returns the same FORBIDDEN code when the transaction type does not exist", async () => {
		const rows = ownedTransactionRows(
			new Map<unknown, Rows>([[transactionType, []]])
		);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "tx1", transactionTypeId: "missing" }),
			"FORBIDDEN"
		);
	});

	it("does not validate the transaction type when the field is omitted", async () => {
		const rows = ownedTransactionRows();
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "tx1", amount: 50 })
		).resolves.toBeDefined();
		// transaction_type is never seeded → no extra ownership read fired.
		expect(rows.has(transactionType)).toBe(false);
		expect(selectWhereParams.length).toBeGreaterThan(0);
	});
});

describe("currencyTransaction ownership errors hide resource existence", () => {
	const createInput = {
		currencyId: "c1",
		transactionTypeId: "tt1",
		amount: 1000,
		transactedAt: "2024-01-01",
	};
	const foreignTransactionRow = {
		currencyTransaction: {
			id: "tx1",
			currencyId: "c1",
			sessionId: null,
		},
		currency: { id: "c1", userId: OTHER },
	};

	it("returns FORBIDDEN when the list currency does not exist", async () => {
		const rows = new Map<unknown, Rows>([[currency, []]]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.listByCurrency({ currencyId: "missing" }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN when the list currency belongs to another user", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OTHER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.listByCurrency({ currencyId: "c1" }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN and skips insert when the create currency does not exist", async () => {
		const rows = new Map<unknown, Rows>([[currency, []]]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(createInput), "FORBIDDEN");
		expect(inserted).toHaveLength(0);
	});

	it("returns FORBIDDEN when the updated transaction does not exist", async () => {
		const rows = new Map<unknown, Rows>([[currencyTransaction, []]]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "missing", amount: 10 }),
			"FORBIDDEN"
		);
	});

	it("returns FORBIDDEN when the updated transaction belongs to another user", async () => {
		const rows = new Map<unknown, Rows>([
			[currencyTransaction, [foreignTransactionRow]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.update({ id: "tx1", amount: 10 }), "FORBIDDEN");
	});

	it("returns FORBIDDEN when the deleted transaction does not exist", async () => {
		const rows = new Map<unknown, Rows>([[currencyTransaction, []]]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.delete({ id: "missing" }), "FORBIDDEN");
	});

	it("returns FORBIDDEN when the deleted transaction belongs to another user", async () => {
		const rows = new Map<unknown, Rows>([
			[currencyTransaction, [foreignTransactionRow]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.delete({ id: "tx1" }), "FORBIDDEN");
	});
});
describe("currencyTransaction.listByCurrency cursor scoping (SA2-182)", () => {
	it("resolves an existing cursor inside the target currency before applying its boundary", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[
				currencyTransaction,
				[
					{
						id: "tx-cursor",
						currencyId: "c1",
						transactedAt: new Date("2024-01-02T00:00:00Z"),
					},
				],
			],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.listByCurrency({ currencyId: "c1", cursor: "tx-cursor" });

		const cursorUses = selectWhereParams.filter((params) =>
			params.includes("tx-cursor")
		);
		expect(cursorUses).toHaveLength(2);
		expect(cursorUses[0]).toEqual(expect.arrayContaining(["tx-cursor", "c1"]));
	});

	it("falls back to the first page when the cursor row was deleted", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[currencyTransaction, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.listByCurrency({ currencyId: "c1", cursor: "tx-cursor" });

		const cursorUses = selectWhereParams.filter((params) =>
			params.includes("tx-cursor")
		);
		expect(cursorUses).toHaveLength(1);
		expect(selectWhereParams.at(-1)).toEqual(["c1"]);
	});

	it("does not resolve or add a cursor boundary when no cursor is supplied", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[currencyTransaction, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.listByCurrency({ currencyId: "c1" });

		expect(selectWhereParams).toHaveLength(2);
		expect(
			selectWhereParams.every((params) => !params.includes("tx-cursor"))
		).toBe(true);
	});
});

describe("currencyTransaction.listByCurrency joined ownership", () => {
	it("owner-scopes the transaction type and session joins that surface names", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[currencyTransaction, []],
		]);
		const { caller, selectJoinParams } = makeCaller(OWNER, rows);

		await caller.listByCurrency({ currencyId: "c1" });

		const ownerScopedJoins = selectJoinParams.filter((params) =>
			params.includes(OWNER)
		);
		expect(ownerScopedJoins).toHaveLength(2);
	});
});
