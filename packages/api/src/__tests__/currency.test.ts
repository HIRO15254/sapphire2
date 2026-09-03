import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createCaller } from "./caller";
import {
	boundParams,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

const CALLER = "user-1";
const OTHER = "user-2";

function createCurrencyListDb(rows: Record<string, unknown>[]) {
	const selectWhereParams: unknown[][] = [];
	const chain = Promise.resolve(rows) as Promise<Record<string, unknown>[]> &
		Record<string, (...args: unknown[]) => unknown>;
	chain.where = (cond: unknown) => {
		selectWhereParams.push(boundParams(cond));
		return chain;
	};
	chain.leftJoin = () => chain;
	chain.groupBy = () => chain;
	chain.orderBy = () => chain;
	const db = { select: () => ({ from: () => chain }) };
	return { db, selectWhereParams };
}

const writers = [
	["create", appRouter.currency.create, {}],
	["update", appRouter.currency.update, { id: "c1" }],
] as const;

describe("currency router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currency).sort()).toEqual(
			["create", "delete", "list", "toggleFavorite", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.currency, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			toggleFavorite: "mutation",
			update: "mutation",
		});
	});
});

describe("currency name validation", () => {
	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});
});

describe("currency unit validation", () => {
	it.each(
		writers
	)("%s accepts a half-width unit of up to 4 characters", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "USD", unit: "$" });
		expectAccepts(procedure, { ...base, name: "Chips", unit: "CHIP" });
	});

	it.each(
		writers
	)("%s rejects a unit longer than 4 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "X", unit: "ABCDE" });
	});

	it.each(writers)("%s rejects a multi-byte unit", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "JPY", unit: "¥" });
		expectRejects(procedure, { ...base, name: "EUR", unit: "€" });
	});

	it("update accepts clearing the unit to null", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: null });
	});
});

describe("currency.list behavior", () => {
	it("list returns all currencies for the authenticated user", async () => {
		const { db, selectWhereParams } = createCurrencyListDb([
			{ id: "c1", userId: CALLER, name: "USD", isFavorite: true },
		]);
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]).currency;

		const list = await caller.list();

		expect(list).toEqual([
			{ id: "c1", userId: CALLER, name: "USD", isFavorite: true },
		]);
		expect(selectWhereParams[0]).toContain(CALLER);
	});
});

describe("currency.create behavior", () => {
	it("create inserts a new currency and returns it", async () => {
		const { caller, inserted } = createCaller({
			select: {
				currency: [
					{
						id: "c1",
						userId: CALLER,
						name: "USD",
						unit: "$",
						description: "US Dollar",
					},
				],
			},
		});

		const created = await caller.currency.create({
			name: "USD",
			unit: "$",
			description: "US Dollar",
		});

		expect(created).toMatchObject({ name: "USD" });
		expect(inserted.currency).toHaveLength(1);
		expect(inserted.currency?.[0]).toMatchObject({
			userId: CALLER,
			name: "USD",
		});
		expect(typeof (inserted.currency?.[0] as Record<string, unknown>).id).toBe(
			"string"
		);
	});
});

describe("currency.update behavior", () => {
	it("update applies partial field changes via conditional spread", async () => {
		const { caller, updated } = createCaller({
			select: {
				currency: [
					{
						id: "c1",
						userId: CALLER,
						name: "USD",
						unit: "$",
						description: "old",
					},
				],
			},
		});

		await caller.currency.update({ id: "c1", name: "EUR" });

		expect(updated.currency?.[0]).toMatchObject({ name: "EUR" });
		expect(updated.currency?.[0]).not.toHaveProperty("unit");
		expect(updated.currency?.[0]).not.toHaveProperty("description");
	});

	it("update rejects with FORBIDDEN when user does not own the currency", async () => {
		const { caller } = createCaller({
			select: { currency: [{ id: "c1", userId: OTHER, name: "USD" }] },
		});

		await expect(
			caller.currency.update({ id: "c1", name: "EUR" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("update rejects with FORBIDDEN when currency does not exist", async () => {
		const { caller } = createCaller({ select: { currency: [] } });

		await expect(
			caller.currency.update({ id: "nonexistent", name: "EUR" })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	});
});

describe("currency.delete behavior", () => {
	it("delete succeeds when currency has no transactions", async () => {
		const { caller } = createCaller({
			select: {
				currency: [{ id: "c1", userId: CALLER }],
				currency_transaction: [],
			},
		});

		const result = await caller.currency.delete({ id: "c1" });

		expect(result).toEqual({ success: true });
	});

	it("delete rejects with CONFLICT when currency has transactions", async () => {
		const { caller } = createCaller({
			select: {
				currency: [{ id: "c1", userId: CALLER }],
				currency_transaction: [{ id: "tx1", currencyId: "c1", amount: 100 }],
			},
		});

		await expect(caller.currency.delete({ id: "c1" })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Currency cannot be deleted while it has transactions",
		});
	});

	it("delete rejects with FORBIDDEN when user does not own the currency", async () => {
		const { caller } = createCaller({
			select: { currency: [{ id: "c1", userId: OTHER }] },
		});

		await expect(caller.currency.delete({ id: "c1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("delete rejects with FORBIDDEN when currency does not exist", async () => {
		const { caller } = createCaller({ select: { currency: [] } });

		await expect(
			caller.currency.delete({ id: "nonexistent" })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	});
});

describe("currency.toggleFavorite behavior", () => {
	it("toggleFavorite flips the isFavorite flag and returns updated row", async () => {
		const { caller, updated } = createCaller({
			select: {
				currency: [{ id: "c1", userId: CALLER, isFavorite: false }],
			},
		});

		await caller.currency.toggleFavorite({ id: "c1" });

		expect(updated.currency?.[0]).toMatchObject({ isFavorite: true });
	});

	it("toggleFavorite rejects with FORBIDDEN when user does not own the currency", async () => {
		const { caller } = createCaller({
			select: { currency: [{ id: "c1", userId: OTHER }] },
		});

		await expect(
			caller.currency.toggleFavorite({ id: "c1" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("toggleFavorite rejects with FORBIDDEN when currency does not exist", async () => {
		const { caller } = createCaller({ select: { currency: [] } });

		await expect(
			caller.currency.toggleFavorite({ id: "nonexistent" })
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	});
});

describe("currency description validation", () => {
	it.each(
		writers
	)("%s accepts a description at the 50,000-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, {
			...base,
			name: "Chips",
			description: "a".repeat(50_000),
		});
	});

	it.each(
		writers
	)("%s rejects a description longer than 50,000 characters", (_name, procedure, base) => {
		expectRejects(procedure, {
			...base,
			name: "Chips",
			description: "a".repeat(50_001),
		});
	});

	it.each(
		writers
	)("%s accepts a null description", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "Chips", description: null });
	});
});
