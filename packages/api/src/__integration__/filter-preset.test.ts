import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

test("duplicate names conflict only within the same user's screen", async ({
	api,
}) => {
	const input = { screenKey: "sessions", name: "Dup", payload: {} } as const;
	const first = requireCreatedRow(await api.alice.filterPreset.create(input));
	await expect(api.alice.filterPreset.create(input)).rejects.toMatchObject({
		code: "CONFLICT",
	});
	expect(await api.db.select().from(filterPreset)).toEqual([first]);
	const otherScreen = requireCreatedRow(
		await api.alice.filterPreset.create({ ...input, screenKey: "statistics" })
	);
	const otherUser = requireCreatedRow(await api.bob.filterPreset.create(input));
	expect(otherScreen).toMatchObject({
		userId: "alice",
		screenKey: "statistics",
		name: "Dup",
	});
	expect(otherUser).toMatchObject({
		userId: "bob",
		screenKey: "sessions",
		name: "Dup",
	});
	const rows = await api.db.select().from(filterPreset);
	expect(rows).toHaveLength(3);
	expect(rows).toEqual(expect.arrayContaining([first, otherScreen, otherUser]));
});

test("conflicting renames preserve stored presets while keeping the current name and omitted payload succeeds", async ({
	api,
}) => {
	const first = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "First",
			payload: { period: "last_7_days" },
		})
	);
	const second = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "Second",
			payload: {},
		})
	);
	const before = await api.db.select().from(filterPreset);
	await expect(
		api.alice.filterPreset.update({ id: first.id, name: second.name })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(await api.db.select().from(filterPreset)).toEqual(before);
	const unchanged = requireCreatedRow(
		await api.alice.filterPreset.update({ id: first.id, name: first.name })
	);
	expect(unchanged).toMatchObject({
		id: first.id,
		name: "First",
		payload: first.payload,
	});
	const renamed = requireCreatedRow(
		await api.alice.filterPreset.update({ id: first.id, name: "Renamed" })
	);
	expect(renamed).toMatchObject({
		id: first.id,
		name: "Renamed",
		payload: first.payload,
	});
	expect(await api.db.select().from(filterPreset)).toEqual(
		expect.arrayContaining([renamed, second])
	);
	expect(await api.db.select().from(filterPreset)).toHaveLength(2);
});
