import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("sessionTag.list usage counts on D1", () => {
	test("counts only the caller's sessions that link the tag", async ({
		api,
	}) => {
		const weekend = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Weekend" })
		);
		const trip = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Trip" })
		);
		const first = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 1000 })
		);
		await api.alice.liveCashGameSession.complete({
			id: first.id,
			finalStack: 1000,
		});
		await api.alice.session.update({
			id: first.id,
			tagIds: [weekend.id, trip.id],
		});
		const second = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 2000 })
		);
		await api.alice.liveCashGameSession.complete({
			id: second.id,
			finalStack: 2000,
		});
		await api.alice.session.update({ id: second.id, tagIds: [weekend.id] });

		expect(await api.caller("alice").sessionTag.list()).toEqual([
			expect.objectContaining({ name: "Trip", usageCount: 1 }),
			expect.objectContaining({ name: "Weekend", usageCount: 2 }),
		]);
		expect(await api.bob.sessionTag.list()).toEqual([]);

		await api.alice.session.update({ id: second.id, tagIds: [] });
		expect(await api.caller("alice").sessionTag.list()).toEqual([
			expect.objectContaining({ name: "Trip", usageCount: 1 }),
			expect.objectContaining({ name: "Weekend", usageCount: 1 }),
		]);
	});
});
