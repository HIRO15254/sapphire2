import { asset } from "@sapphire2/db/schema/asset";
import { entryTag } from "@sapphire2/db/schema/entry-tag";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { room } from "@sapphire2/db/schema/room";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { sql } from "drizzle-orm";
import { expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

test("duplicate names conflict only within the same user's screen", async ({
	api,
}) => {
	const input = { name: "Dup", payload: {}, screenKey: "sessions" } as const;
	const first = requireCreatedRow(await api.alice.filterPreset.create(input));
	await expect(api.alice.filterPreset.create(input)).rejects.toMatchObject({
		code: "CONFLICT",
	});
	expect(await api.db.select().from(filterPreset)).toEqual([first]);
	const otherScreen = requireCreatedRow(
		await api.alice.filterPreset.create({
			...input,
			payload: { normalized: true },
			screenKey: "statistics",
		})
	);
	const otherUser = requireCreatedRow(await api.bob.filterPreset.create(input));
	expect(await api.alice.filterPreset.list({ screenKey: "sessions" })).toEqual([
		first,
	]);
	expect(otherScreen).toMatchObject({
		name: "Dup",
		screenKey: "statistics",
		userId: "alice",
	});
	expect(otherUser).toMatchObject({
		name: "Dup",
		screenKey: "sessions",
		userId: "bob",
	});
	const rows = await api.db.select().from(filterPreset);
	expect(rows).toHaveLength(3);
	expect(rows).toEqual(expect.arrayContaining([first, otherScreen, otherUser]));
});

test("case-insensitive preset names conflict without blocking a case-only self-rename", async ({
	api,
}) => {
	const first = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "  Morning  ",
			payload: {},
			screenKey: "sessions",
		})
	);
	await expect(
		api.alice.filterPreset.create({
			name: "morning",
			payload: {},
			screenKey: "sessions",
		})
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(
		(await api.alice.filterPreset.update({ id: first.id, name: "MORNING" }))
			?.name
	).toBe("MORNING");
});

test("setting a default preserves other screens and a default when the target disappears before the batch", async ({
	api,
}) => {
	const first = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "First",
			payload: {},
			screenKey: "sessions",
		})
	);
	const second = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Second",
			payload: {},
			screenKey: "sessions",
		})
	);
	const other = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Statistics",
			payload: { normalized: true },
			screenKey: "statistics",
		})
	);
	await api.alice.filterPreset.setDefault({ id: first.id });
	await api.alice.filterPreset.setDefault({ id: other.id });
	await api.alice.filterPreset.setDefault({ id: second.id });
	let sessions = await api.alice.filterPreset.list({ screenKey: "sessions" });
	expect(sessions.find((row) => row.id === first.id)?.isDefault).toBe(false);
	expect(sessions.find((row) => row.id === second.id)?.isDefault).toBe(true);
	expect(
		(await api.alice.filterPreset.list({ screenKey: "statistics" }))[0]
			?.isDefault
	).toBe(true);

	const raced = api.raceCaller("alice", () =>
		api.alice.filterPreset.delete({ id: first.id })
	);
	await expect(
		raced.filterPreset.setDefault({ id: first.id })
	).rejects.toMatchObject({ code: "CONFLICT" });
	sessions = await api.alice.filterPreset.list({ screenKey: "sessions" });
	expect(sessions.find((row) => row.id === second.id)?.isDefault).toBe(true);
});

test("clearing a default conflicts if the target is deleted after authorization", async ({
	api,
}) => {
	const preset = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Default",
			payload: {},
			screenKey: "sessions",
		})
	);
	await api.alice.filterPreset.setDefault({ id: preset.id });
	const raced = api.raceCaller("alice", () =>
		api.alice.filterPreset.delete({ id: preset.id })
	);
	await expect(
		raced.filterPreset.clearDefault({ id: preset.id })
	).rejects.toMatchObject({ code: "CONFLICT" });
	expect(await api.alice.filterPreset.list({ screenKey: "sessions" })).toEqual(
		[]
	);
});

test("conflicting renames preserve stored presets while keeping the current name and omitted payload succeeds", async ({
	api,
}) => {
	const first = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "First",
			payload: { period: "last_7_days" },
			screenKey: "sessions",
		})
	);
	const second = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Second",
			payload: {},
			screenKey: "sessions",
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

test("converted filters and both tag families survive create, list and update", async ({
	api,
}) => {
	await api.db
		.insert(room)
		.values({ id: "alice-room", name: "Room", userId: "alice" });
	await api.db.insert(asset).values({
		id: "alice-base",
		kind: "currency",
		name: "Base",
		userId: "alice",
	});
	await api.db
		.insert(entryTag)
		.values({ id: "alice-entry-tag", name: "Entry", userId: "alice" });
	await api.db.insert(tournamentTag).values({
		id: "alice-tournament-tag",
		name: "Tournament",
		userId: "alice",
	});
	const payload = {
		baseAssetId: "alice-base",
		entryTagIds: ["alice-entry-tag"],
		roomId: "alice-room",
		tournamentTagIds: ["alice-tournament-tag"],
		valuation: "real",
	} as const;
	const created = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Converted",
			payload: {
				...payload,
				entryTagIds: [...payload.entryTagIds],
				tournamentTagIds: [...payload.tournamentTagIds],
			},
			screenKey: "statistics",
		})
	);
	expect(created.payload).toEqual(payload);
	expect(
		(await api.alice.filterPreset.list({ screenKey: "statistics" }))[0]?.payload
	).toEqual(payload);
	const updatedPayload = {
		...payload,
		entryTagIds: [...payload.entryTagIds],
		tournamentTagIds: [...payload.tournamentTagIds],
		valuation: "virtual" as const,
	};
	const updated = requireCreatedRow(
		await api.alice.filterPreset.update({
			id: created.id,
			payload: updatedPayload,
		})
	);
	expect(updated.payload).toEqual(updatedPayload);
	expect(
		(await api.alice.filterPreset.list({ screenKey: "statistics" }))[0]?.payload
	).toEqual(updatedPayload);
});

test("foreign filter references are forbidden on create and update without changing persisted data", async ({
	api,
}) => {
	await api.db
		.insert(room)
		.values({ id: "bob-room", name: "Room", userId: "bob" });
	await api.db
		.insert(asset)
		.values({ id: "bob-asset", name: "Asset", userId: "bob" });
	await api.db
		.insert(entryTag)
		.values({ id: "bob-entry-tag", name: "Entry", userId: "bob" });
	await api.db
		.insert(tournamentTag)
		.values({ id: "bob-tournament-tag", name: "Tournament", userId: "bob" });
	const created = requireCreatedRow(
		await api.alice.filterPreset.create({
			name: "Owned",
			payload: {},
			screenKey: "sessions",
		})
	);
	const before = await api.db.select().from(filterPreset);
	for (const payload of [
		{ roomId: "bob-room" },
		{ assetId: "bob-asset" },
		{ baseAssetId: "bob-asset", valuation: "real" as const },
		{ entryTagIds: ["bob-entry-tag"] },
		{ tournamentTagIds: ["bob-tournament-tag"] },
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
		await expect(
			api.alice.filterPreset.create({
				name: "Foreign",
				payload,
				screenKey: "sessions",
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.filterPreset.update({ id: created.id, payload })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	}
	expect(await api.db.select().from(filterPreset)).toEqual(before);
});

test("base asset must be an owned currency and invalid stored payloads fail closed", async ({
	api,
}) => {
	await api.db
		.insert(asset)
		.values({ id: "item", kind: "item", name: "Item", userId: "alice" });
	await expect(
		api.alice.filterPreset.create({
			name: "Invalid",
			payload: { baseAssetId: "item", valuation: "real" },
			screenKey: "statistics",
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await api.db.insert(filterPreset).values({
		id: "invalid-preset",
		name: "Legacy",
		payload: sql`'{"norm":"off"}'`,
		screenKey: "statistics",
		userId: "alice",
	});
	await expect(
		api.alice.filterPreset.list({ screenKey: "statistics" })
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
