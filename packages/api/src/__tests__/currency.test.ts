import {
	currency as currencyTable,
	currencyTransaction as currencyTransactionTable,
} from "@sapphire2/db/schema/currency";
import { item as itemTable } from "@sapphire2/db/schema/item";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

type Rows = Record<string, unknown>[];

/** Table-keyed chainable mock db for exercising the delete guards. */
function createGuardMockDb(rowsByTable: Map<unknown, Rows>) {
	const deleted: { table: unknown }[] = [];
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = () => chain;
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.groupBy = () => chain;
		chain.innerJoin = () => chain;
		chain.leftJoin = () => chain;
		return chain;
	};
	const db = {
		select: () => makeChain([]),
		insert: () => ({ values: () => Promise.resolve(undefined) }),
		update: () => ({
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: (table: unknown) => {
			deleted.push({ table });
			return { where: () => Promise.resolve(undefined) };
		},
	};
	return { db, deleted };
}

describe("currency router", () => {
	it("appRouter has currency namespace", () => {
		expect(appRouter.currency).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.currency.list).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.currency.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.currency.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.currency.delete).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currency).sort()).toEqual(
			["create", "delete", "list", "toggleFavorite", "update"].sort()
		);
	});

	it("has toggleFavorite procedure", () => {
		expect(appRouter.currency.toggleFavorite).toBeDefined();
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.currency.list);
		expectType(appRouter.currency.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.currency.create,
			appRouter.currency.update,
			appRouter.currency.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});

	it("toggleFavorite is a protected mutation", () => {
		expectProtected(appRouter.currency.toggleFavorite);
		expectType(appRouter.currency.toggleFavorite, "mutation");
	});
});

describe("currency.create input validation", () => {
	it("accepts minimal payload (name only)", () => {
		expectAccepts(appRouter.currency.create, { name: "JPY" });
	});

	it("accepts optional half-width unit (≤4 chars)", () => {
		expectAccepts(appRouter.currency.create, { name: "USD", unit: "$" });
		expectAccepts(appRouter.currency.create, { name: "JPY", unit: "JPY" });
		expectAccepts(appRouter.currency.create, { name: "Chips", unit: "PT" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.currency.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.currency.create, {});
	});

	it("rejects non-string name", () => {
		expectRejects(appRouter.currency.create, { name: 123 });
	});

	it("rejects unit longer than 4 characters", () => {
		expectRejects(appRouter.currency.create, { name: "X", unit: "ABCDE" });
	});

	it("rejects multi-byte unit (full-width / non-ASCII)", () => {
		expectRejects(appRouter.currency.create, { name: "JPY", unit: "¥" });
		expectRejects(appRouter.currency.create, { name: "EUR", unit: "€" });
	});

	it("accepts an optional rich-text description", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: "<p>Weekday game chips</p>",
		});
	});

	it("accepts a null description (no description set)", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: null,
		});
	});

	it("accepts a description at the 50,000-character boundary", () => {
		expectAccepts(appRouter.currency.create, {
			name: "Chips",
			description: "a".repeat(50_000),
		});
	});

	it("rejects a description longer than 50,000 characters", () => {
		expectRejects(appRouter.currency.create, {
			name: "Chips",
			description: "a".repeat(50_001),
		});
	});
});

describe("currency.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.currency.update, { id: "c1" });
	});

	it("accepts id + name", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", name: "USD" });
	});

	it("accepts id + unit", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: "$" });
	});

	it("accepts unit cleared to null", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: null });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.currency.update, { id: "c1", name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.update, { name: "USD" });
	});

	it("rejects unit longer than 4 characters", () => {
		expectRejects(appRouter.currency.update, { id: "c1", unit: "ABCDE" });
	});

	it("rejects multi-byte unit", () => {
		expectRejects(appRouter.currency.update, { id: "c1", unit: "¥" });
	});

	it("accepts id + description", () => {
		expectAccepts(appRouter.currency.update, {
			id: "c1",
			description: "<p>Updated</p>",
		});
	});

	it("accepts id + null description (clearing it)", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", description: null });
	});

	it("rejects a description longer than 50,000 characters", () => {
		expectRejects(appRouter.currency.update, {
			id: "c1",
			description: "a".repeat(50_001),
		});
	});
});

describe("currency.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currency.delete, { id: "c1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currency.delete, { id: 42 });
	});
});

describe("currency.toggleFavorite input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currency.toggleFavorite, { id: "c1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.toggleFavorite, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currency.toggleFavorite, { id: 42 });
	});
});

describe("currencyTransaction router", () => {
	it("appRouter has currencyTransaction namespace", () => {
		expect(appRouter.currencyTransaction).toBeDefined();
	});

	it("has listByCurrency procedure", () => {
		expect(appRouter.currencyTransaction.listByCurrency).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.currencyTransaction.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.currencyTransaction.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.currencyTransaction.delete).toBeDefined();
	});
});

describe("currency.delete guard — items valued in the currency", () => {
	async function callDelete(rowsByTable: Map<unknown, Rows>) {
		const { db, deleted } = createGuardMockDb(rowsByTable);
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).currency;
		return { promise: caller.delete({ id: "c1" }), deleted };
	}

	it("rejects with CONFLICT while an item is valued in the currency", async () => {
		const { promise, deleted } = await callDelete(
			new Map<unknown, Rows>([
				[currencyTable, [{ id: "c1", userId: "user-1" }]],
				[currencyTransactionTable, []],
				[itemTable, [{ id: "i1", currencyId: "c1" }]],
			])
		);
		await expect(promise).rejects.toMatchObject({ code: "CONFLICT" });
		expect(deleted).toHaveLength(0);
	});

	it("deletes when no transactions and no items reference the currency", async () => {
		const { promise, deleted } = await callDelete(
			new Map<unknown, Rows>([
				[currencyTable, [{ id: "c1", userId: "user-1" }]],
				[currencyTransactionTable, []],
				[itemTable, []],
			])
		);
		await expect(promise).resolves.toEqual({ success: true });
		expect(deleted).toHaveLength(1);
	});
});
