import { ringGame } from "@sapphire2/db/schema/ring-game";
import { eq } from "drizzle-orm";
import { describe, expect, vi } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("ring-game buy-in ranges on D1", () => {
	test("rejects an inverted range on create without saving a rule", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);

		await expect(
			api.alice.ringGame.create({
				roomId: club.id,
				name: "Broken range",
				minBuyIn: 200,
				maxBuyIn: 100,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await api.db.select().from(ringGame)).toEqual([]);
	});

	test("persists equal bounds, zero, and either missing bound on create", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const ranges = [
			{ minBuyIn: 100, maxBuyIn: 100 },
			{ minBuyIn: 0, maxBuyIn: 0 },
			{ minBuyIn: 200, maxBuyIn: undefined },
			{ minBuyIn: undefined, maxBuyIn: 100 },
		];
		for (const range of ranges) {
			const saved = requireCreatedRow(
				await api.alice.ringGame.create({
					roomId: club.id,
					name: "Valid range",
					...range,
				})
			);
			expect(
				await api.db.select().from(ringGame).where(eq(ringGame.id, saved.id))
			).toEqual([
				expect.objectContaining({
					minBuyIn: range.minBuyIn ?? null,
					maxBuyIn: range.maxBuyIn ?? null,
				}),
			]);
		}
	});

	test("rejects inverted full and partial updates without changing any fields", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const saved = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "Original",
				minBuyIn: 100,
				maxBuyIn: 200,
			})
		);
		const before = await api.db.select().from(ringGame);
		for (const range of [
			{ minBuyIn: 200, maxBuyIn: 100 },
			{ minBuyIn: 201 },
			{ maxBuyIn: 99 },
			{ minBuyIn: 1, maxBuyIn: 0 },
		]) {
			await expect(
				api.alice.ringGame.update({
					id: saved.id,
					name: "Must not be saved",
					...range,
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(await api.db.select().from(ringGame)).toEqual(before);
		}
	});

	test("updates both bounds together and allows equality on partial updates", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const saved = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "Valid range",
				minBuyIn: 100,
				maxBuyIn: 200,
			})
		);
		const updates = [
			{ input: { minBuyIn: 300, maxBuyIn: 400 }, min: 300, max: 400 },
			{ input: { minBuyIn: 400 }, min: 400, max: 400 },
			{ input: { minBuyIn: 0, maxBuyIn: 100 }, min: 0, max: 100 },
			{ input: { maxBuyIn: 0 }, min: 0, max: 0 },
			{ input: { name: "Renamed" }, min: 0, max: 0 },
		];
		for (const { input, min, max } of updates) {
			await api.alice.ringGame.update({ id: saved.id, ...input });
			expect(
				await api.db.select().from(ringGame).where(eq(ringGame.id, saved.id))
			).toEqual([expect.objectContaining({ minBuyIn: min, maxBuyIn: max })]);
		}
	});

	test("treats null as clearing a bound and omission as preserving it", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const saved = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "Valid range",
				minBuyIn: 100,
				maxBuyIn: 200,
			})
		);
		const updates = [
			{ input: { minBuyIn: 300, maxBuyIn: null }, min: 300, max: null },
			{ input: { minBuyIn: null, maxBuyIn: 50 }, min: null, max: 50 },
			{ input: { maxBuyIn: null }, min: null, max: null },
			{ input: { minBuyIn: 200 }, min: 200, max: null },
			{ input: { minBuyIn: null, maxBuyIn: 100 }, min: null, max: 100 },
		];
		for (const { input, min, max } of updates) {
			await api.alice.ringGame.update({ id: saved.id, ...input });
			expect(
				await api.db.select().from(ringGame).where(eq(ringGame.id, saved.id))
			).toEqual([expect.objectContaining({ minBuyIn: min, maxBuyIn: max })]);
		}
	});

	test("keeps the range ordered when opposite bounds are updated concurrently", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const saved = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "Concurrent range",
				minBuyIn: 50,
				maxBuyIn: 200,
			})
		);
		const gate = Promise.withResolvers<void>();
		let pendingUpdates = 0;
		const update = api.db.update.bind(api.db);
		const updateSpy = vi.spyOn(api.db, "update").mockImplementation((table) => {
			const builder = update(table);
			const set = builder.set.bind(builder);
			vi.spyOn(builder, "set").mockImplementation((values) => {
				const statement = set(values);
				const execute = statement.execute.bind(statement);
				vi.spyOn(statement, "execute").mockImplementation(async () => {
					pendingUpdates += 1;
					if (pendingUpdates === 2) {
						gate.resolve();
					}
					await gate.promise;
					return execute();
				});
				return statement;
			});
			return builder;
		});
		try {
			const results = await Promise.allSettled([
				api.alice.ringGame.update({ id: saved.id, minBuyIn: 150 }),
				api.caller("alice").ringGame.update({ id: saved.id, maxBuyIn: 100 }),
			]);
			expect(
				results.filter((result) => result.status === "fulfilled")
			).toHaveLength(1);
			expect(results.filter((result) => result.status === "rejected")).toEqual([
				{
					status: "rejected",
					reason: expect.objectContaining({ code: "BAD_REQUEST" }),
				},
			]);
			const [stored] = await api.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, saved.id));
			expect([
				{ minBuyIn: 150, maxBuyIn: 200 },
				{ minBuyIn: 50, maxBuyIn: 100 },
			]).toContainEqual({
				minBuyIn: stored?.minBuyIn,
				maxBuyIn: stored?.maxBuyIn,
			});
		} finally {
			updateSpy.mockRestore();
		}
	});
});
