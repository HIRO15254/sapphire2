import { currency } from "@sapphire2/db/schema/currency";
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
		chain.groupBy = () => chain;
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
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).item;
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

describe("item router structure", () => {
	it("appRouter has item namespace", () => {
		expect(appRouter.item).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.item).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.item.list);
		expectType(appRouter.item.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.item.create,
			appRouter.item.update,
			appRouter.item.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("item.create input validation", () => {
	const valid = { name: "Tournament ticket", currencyId: "c1", unitValue: 1000 };

	it("accepts a minimal valid payload", () => {
		expectAccepts(appRouter.item.create, valid);
	});

	it("accepts unitValue 0 (worthless but trackable item)", () => {
		expectAccepts(appRouter.item.create, { ...valid, unitValue: 0 });
	});

	it("accepts an optional description and null description", () => {
		expectAccepts(appRouter.item.create, { ...valid, description: "<p>x</p>" });
		expectAccepts(appRouter.item.create, { ...valid, description: null });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.item.create, { ...valid, name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.item.create, {
			currencyId: "c1",
			unitValue: 1000,
		});
	});

	it("rejects missing currencyId", () => {
		expectRejects(appRouter.item.create, {
			name: "Ticket",
			unitValue: 1000,
		});
	});

	it("rejects missing unitValue", () => {
		expectRejects(appRouter.item.create, { name: "Ticket", currencyId: "c1" });
	});

	it("rejects negative unitValue", () => {
		expectRejects(appRouter.item.create, { ...valid, unitValue: -1 });
	});

	it("rejects non-integer unitValue", () => {
		expectRejects(appRouter.item.create, { ...valid, unitValue: 10.5 });
	});

	it("rejects a description longer than 50,000 characters", () => {
		expectRejects(appRouter.item.create, {
			...valid,
			description: "a".repeat(50_001),
		});
	});
});

describe("item.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.item.update, { id: "i1" });
	});

	it("accepts partial updates", () => {
		expectAccepts(appRouter.item.update, { id: "i1", name: "New name" });
		expectAccepts(appRouter.item.update, { id: "i1", unitValue: 500 });
		expectAccepts(appRouter.item.update, { id: "i1", currencyId: "c2" });
		expectAccepts(appRouter.item.update, { id: "i1", description: null });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.item.update, { name: "x" });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.item.update, { id: "i1", name: "" });
	});

	it("rejects negative unitValue when provided", () => {
		expectRejects(appRouter.item.update, { id: "i1", unitValue: -5 });
	});

	it("rejects non-integer unitValue when provided", () => {
		expectRejects(appRouter.item.update, { id: "i1", unitValue: 1.5 });
	});
});

describe("item.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.item.delete, { id: "i1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.item.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.item.delete, { id: 5 });
	});
});

describe("item.create currency ownership", () => {
	const valid = { name: "Ticket", currencyId: "c1", unitValue: 1000 };

	it("accepts a currency owned by the caller and inserts the item", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OWNER }]],
			[item, [{ id: "i-new" }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(caller.create(valid)).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === item)).toBe(true);
	});

	it("rejects a currency owned by another user with FORBIDDEN and skips the insert", async () => {
		const rows = new Map<unknown, Rows>([
			[currency, [{ id: "c1", userId: OTHER }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(valid), "FORBIDDEN");
		expect(inserted).toHaveLength(0);
	});

	it("returns the same FORBIDDEN code when the currency does not exist", async () => {
		const rows = new Map<unknown, Rows>([[currency, []]]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.create(valid), "FORBIDDEN");
		expect(inserted).toHaveLength(0);
	});
});

describe("item.update ownership", () => {
	it("accepts an item owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "i1", name: "Renamed" })
		).resolves.toBeDefined();
	});

	it("rejects a foreign item with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OTHER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.update({ id: "i1", name: "x" }), "FORBIDDEN");
	});

	it("returns the same FORBIDDEN code when the item does not exist", async () => {
		const rows = new Map<unknown, Rows>([[item, []]]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.update({ id: "i1", name: "x" }), "FORBIDDEN");
	});

	it("validates ownership of a newly assigned currencyId", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[currency, [{ id: "c2", userId: OTHER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "i1", currencyId: "c2" }),
			"FORBIDDEN"
		);
	});
});

describe("item.delete guards", () => {
	it("deletes an unused item owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[itemTransaction, []],
		]);
		const { caller, deleted } = makeCaller(OWNER, rows);
		await expect(caller.delete({ id: "i1" })).resolves.toEqual({
			success: true,
		});
		expect(deleted.some((d) => d.table === item)).toBe(true);
	});

	it("rejects a foreign item with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OTHER }]],
		]);
		const { caller, deleted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.delete({ id: "i1" }), "FORBIDDEN");
		expect(deleted).toHaveLength(0);
	});

	it("rejects with CONFLICT while the item has ledger transactions (cascade guard)", async () => {
		const rows = new Map<unknown, Rows>([
			[item, [{ id: "i1", userId: OWNER }]],
			[itemTransaction, [{ id: "itx1" }]],
		]);
		const { caller, deleted } = makeCaller(OWNER, rows);
		await expectTrpcCode(caller.delete({ id: "i1" }), "CONFLICT");
		expect(deleted).toHaveLength(0);
	});
});
