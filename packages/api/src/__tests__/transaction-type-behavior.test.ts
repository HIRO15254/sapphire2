import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { createChainableMockDb } from "./test-utils";

function callerFor(db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: "user-1" } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]);
}

describe("transactionType reserved name behavior", () => {
	it("rejects create before reading from or writing to the database", async () => {
		let dbAccesses = 0;
		const db = new Proxy(
			{},
			{
				get() {
					dbAccesses += 1;
					throw new Error("database must not be accessed");
				},
			}
		);

		await expect(
			callerFor(db).transactionType.create({ name: " session result " })
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(dbAccesses).toBe(0);
	});

	it("rejects update before ownership lookup or any database write", async () => {
		let dbAccesses = 0;
		const db = new Proxy(
			{},
			{
				get() {
					dbAccesses += 1;
					throw new Error("database must not be accessed");
				},
			}
		);

		await expect(
			callerFor(db).transactionType.update({
				id: "type-1",
				name: "SESSION RESULT",
			})
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(dbAccesses).toBe(0);
	});
});

describe("transactionType default seeding", () => {
	it("tolerates Session Result being created concurrently with default seeding", async () => {
		const seeded = [
			{
				id: "winner",
				userId: "user-1",
				name: "Session Result",
				updatedAt: new Date(1),
			},
			{ id: "purchase", userId: "user-1", name: "Purchase" },
			{ id: "bonus", userId: "user-1", name: "Bonus" },
			{ id: "other", userId: "user-1", name: "Other" },
		];
		let selectCall = 0;
		const onConflictDoNothing = vi.fn(() => undefined);
		const values = vi.fn(() => ({ onConflictDoNothing }));
		const db = {
			select: vi.fn(() => ({
				from: () => ({
					where: () => Promise.resolve(selectCall++ === 0 ? [] : seeded),
				}),
			})),
			insert: vi.fn(() => ({ values })),
		};

		await expect(callerFor(db).transactionType.list()).resolves.toEqual(seeded);
		expect(values).toHaveBeenCalledTimes(1);
		expect(values.mock.calls[0]?.[0]).toHaveLength(4);
		expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
		expect(db.select).toHaveBeenCalledTimes(2);
	});

	it("returns existing rows without attempting a seed", async () => {
		const existing = [{ id: "existing", userId: "user-1", name: "Bonus" }];
		const db = {
			select: vi.fn(() => ({
				from: () => ({ where: () => Promise.resolve(existing) }),
			})),
			insert: vi.fn(),
		};

		await expect(callerFor(db).transactionType.list()).resolves.toEqual(
			existing
		);
		expect(db.select).toHaveBeenCalledTimes(1);
		expect(db.insert).toHaveBeenCalledTimes(0);
	});
});

describe("transactionType caller behavior", () => {
	it("create returns the created transaction type with correct shape", async () => {
		const mock = createChainableMockDb({
			select: {
				transaction_type: [
					{
						id: "tt-created",
						userId: "user-1",
						name: "Test",
						updatedAt: new Date(1),
					},
				],
			},
		});

		const created = await callerFor(mock.db).transactionType.create({
			name: "Test",
		});

		expect(created).toEqual({
			id: "tt-created",
			userId: "user-1",
			name: "Test",
			updatedAt: new Date(1),
		});
		expect(mock.inserted.transaction_type).toEqual([
			{
				id: expect.any(String),
				userId: "user-1",
				name: "Test",
				updatedAt: expect.any(Date),
			},
		]);
	});

	it("update returns the updated transaction type with correct shape", async () => {
		const mock = createChainableMockDb({
			select: {
				transaction_type: [
					{
						id: "tt-1",
						userId: "user-1",
						name: "New",
						updatedAt: new Date(2),
					},
				],
			},
		});

		const updated = await callerFor(mock.db).transactionType.update({
			id: "tt-1",
			name: "New",
		});

		expect(updated).toEqual({
			id: "tt-1",
			userId: "user-1",
			name: "New",
			updatedAt: new Date(2),
		});
		expect(mock.updated.transaction_type).toEqual([
			{ name: "New", updatedAt: expect.any(Date) },
		]);
	});

	it("delete rejects PRECONDITION_FAILED when transaction type is in use", async () => {
		const mock = createChainableMockDb({
			select: {
				transaction_type: [{ id: "tt-1", userId: "user-1" }],
				currency_transaction: [{ transactionTypeId: "tt-1" }],
			},
		});

		await expect(
			callerFor(mock.db).transactionType.delete({ id: "tt-1" })
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
	});

	it("delete succeeds and returns success true when transaction type is not in use", async () => {
		const mock = createChainableMockDb({
			select: {
				transaction_type: [{ id: "tt-1", userId: "user-1" }],
				currency_transaction: [],
			},
		});

		const result = await callerFor(mock.db).transactionType.delete({
			id: "tt-1",
		});

		expect(result).toEqual({ success: true });
	});
});
