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
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

type Rows = Record<string, unknown>[];
const dialect = new SQLiteSyncDialect();

function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const selectWhereParams: unknown[][] = [];
	const selectJoinParams: unknown[][] = [];
	const inserted: { table: unknown; values: unknown }[] = [];
	const updated: unknown[] = [];
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
			set: (values: unknown) => {
				updated.push(values);
				return { where: () => Promise.resolve(undefined) };
			},
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
	};
	return { db, inserted, selectJoinParams, selectWhereParams, updated };
}

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, inserted, selectJoinParams, selectWhereParams, updated } =
		createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<
		typeof appRouter.createCaller
	>[0]).currencyTransaction;
	return { caller, inserted, selectJoinParams, selectWhereParams, updated };
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

const writers = [
	[
		"create",
		appRouter.currencyTransaction.create,
		{ currencyId: "c1", transactionTypeId: "tt1", transactedAt: "2024-01-01" },
	],
	["update", appRouter.currencyTransaction.update, { id: "tx1" }],
] as const;

describe("currencyTransaction router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currencyTransaction).sort()).toEqual(
			["create", "delete", "listByCurrency", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.currencyTransaction, {
			create: "mutation",
			delete: "mutation",
			listByCurrency: "query",
			update: "mutation",
		});
	});
});

describe("currencyTransaction.listByCurrency input validation", () => {
	it("accepts a currencyId with a cursor", () => {
		expectAccepts(appRouter.currencyTransaction.listByCurrency, {
			currencyId: "c1",
			cursor: "tx-42",
		});
	});
});

describe("currencyTransaction amount validation", () => {
	it.each(
		writers
	)("%s accepts a negative amount (expense / loss)", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, amount: -500 });
	});

	it.each(
		writers
	)("%s rejects a non-integer amount", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, amount: 12.5 });
	});
});

describe("currencyTransaction transactedAt validation", () => {
	it.each([
		["an arbitrary string", "not-a-date"],
		["an impossible calendar date", "2024-02-30"],
		["a timestamp instead of a date-only value", "2024-01-01T00:00:00Z"],
	])("create and update reject transactedAt as %s", (_scenario, transactedAt) => {
		for (const [, procedure, base] of writers) {
			expectRejects(procedure, { ...base, amount: 100, transactedAt });
		}
	});
});

describe("currencyTransaction.update input validation", () => {
	it("accepts memo: null (explicit clear)", () => {
		expectAccepts(appRouter.currencyTransaction.update, {
			id: "tx1",
			memo: null,
		});
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
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(caller.create(validInput)).resolves.toEqual({ id: "tx-new" });
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.values).toMatchObject({
			currencyId: "c1",
			transactionTypeId: "tt1",
			amount: 1000,
		});
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
		const { caller, updated } = makeCaller(OWNER, rows);
		await caller.update({ id: "tx1", transactionTypeId: "tt2" });
		expect(updated).toEqual([{ transactionTypeId: "tt2" }]);
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

describe("currencyTransaction session-generated transactions are immutable", () => {
	function sessionGeneratedRows() {
		return new Map<unknown, Rows>([
			[
				currencyTransaction,
				[
					{
						currencyTransaction: {
							id: "tx1",
							currencyId: "c1",
							sessionId: "session-1",
						},
						currency: { id: "c1", userId: OWNER },
					},
				],
			],
		]);
	}

	it("rejects update and delete when transaction is session-generated", async () => {
		const { caller: updateCaller, updated } = makeCaller(
			OWNER,
			sessionGeneratedRows()
		);
		await expectTrpcCode(
			updateCaller.update({ id: "tx1", amount: 10 }),
			"FORBIDDEN"
		);
		expect(updated).toHaveLength(0);

		const { caller: deleteCaller } = makeCaller(OWNER, sessionGeneratedRows());
		await expectTrpcCode(deleteCaller.delete({ id: "tx1" }), "FORBIDDEN");
	});
});

function ownedNonSessionTransactionRows(): Map<unknown, Rows> {
	return new Map<unknown, Rows>([
		[
			currencyTransaction,
			[
				{
					currencyTransaction: { id: "tx1", currencyId: "c1", sessionId: null },
					currency: { id: "c1", userId: OWNER },
				},
			],
		],
	]);
}

describe("currencyTransaction.update transactedAt persistence", () => {
	it("stores transactedAt as a Date on the owned non-session-generated transaction", async () => {
		const rows = ownedNonSessionTransactionRows();
		const { caller, updated } = makeCaller(OWNER, rows);

		await caller.update({ id: "tx1", transactedAt: "2024-02-01" });

		expect(updated).toEqual([{ transactedAt: new Date("2024-02-01") }]);
	});
});

describe("currencyTransaction.delete success", () => {
	it("deletes the owned non-session-generated transaction", async () => {
		const rows = ownedNonSessionTransactionRows();
		const { caller } = makeCaller(OWNER, rows);

		await expect(caller.delete({ id: "tx1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("currencyTransaction memo persistence", () => {
	it("preserves explicit memo value on create and update", async () => {
		const createRows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[transactionType, [{ id: "tt1", userId: OWNER }]],
			[currencyTransaction, [{ id: "tx-new" }]],
		]);
		const { caller: createCaller, inserted } = makeCaller(OWNER, createRows);
		await createCaller.create({
			currencyId: "c1",
			transactionTypeId: "tt1",
			amount: 1000,
			transactedAt: "2024-01-01",
			memo: "test memo",
		});
		expect(inserted[0]?.values).toMatchObject({ memo: "test memo" });

		const updateRows = new Map<unknown, Rows>([
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
		const { caller: updateCaller, updated } = makeCaller(OWNER, updateRows);
		await updateCaller.update({ id: "tx1", memo: "updated memo" });
		expect(updated).toEqual([{ memo: "updated memo" }]);
	});
});
