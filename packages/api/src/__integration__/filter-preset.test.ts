import { asset } from "@sapphire2/db/schema/asset";
import { entryTag } from "@sapphire2/db/schema/entry-tag";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { room } from "@sapphire2/db/schema/room";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { eq, sql } from "drizzle-orm";
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
		await api.alice.filterPreset.create({
			...input,
			screenKey: "statistics",
			payload: { normalized: true },
		})
	);
	const otherUser = requireCreatedRow(await api.bob.filterPreset.create(input));
	expect(await api.alice.filterPreset.list({ screenKey: "sessions" })).toEqual([
		first,
	]);
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

test("case-insensitive preset names conflict without blocking a case-only self-rename", async ({
	api,
}) => {
	const first = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "  Morning  ",
			payload: {},
		})
	);
	await expect(
		api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "morning",
			payload: {},
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
			screenKey: "sessions",
			name: "First",
			payload: {},
		})
	);
	const second = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "Second",
			payload: {},
		})
	);
	const other = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "statistics",
			name: "Statistics",
			payload: { normalized: true },
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

	const disappearingDb = new Proxy(api.db, {
		get(target, property, receiver) {
			if (property === "batch") {
				return async (...args: Parameters<typeof api.db.batch>) => {
					await api.db
						.delete(filterPreset)
						.where(eq(filterPreset.id, first.id));
					return api.db.batch(...args);
				};
			}
			return Reflect.get(target, property, receiver);
		},
	});
	await api
		.caller("alice", disappearingDb)
		.filterPreset.setDefault({ id: first.id });
	sessions = await api.alice.filterPreset.list({ screenKey: "sessions" });
	expect(sessions.find((row) => row.id === second.id)?.isDefault).toBe(true);
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

test("converted filters and both tag families survive create, list and update", async ({
	api,
}) => {
	await api.db
		.insert(room)
		.values({ id: "alice-room", userId: "alice", name: "Room" });
	await api.db.insert(asset).values({
		id: "alice-base",
		userId: "alice",
		name: "Base",
		kind: "currency",
	});
	await api.db
		.insert(entryTag)
		.values({ id: "alice-entry-tag", userId: "alice", name: "Entry" });
	await api.db.insert(tournamentTag).values({
		id: "alice-tournament-tag",
		userId: "alice",
		name: "Tournament",
	});
	const payload = {
		valuation: "real",
		baseAssetId: "alice-base",
		roomId: "alice-room",
		entryTagIds: ["alice-entry-tag"],
		tournamentTagIds: ["alice-tournament-tag"],
	} as const;
	const created = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "statistics",
			name: "Converted",
			payload: {
				...payload,
				entryTagIds: [...payload.entryTagIds],
				tournamentTagIds: [...payload.tournamentTagIds],
			},
		})
	);
	expect(created.payload).toEqual(payload);
	expect(
		(await api.alice.filterPreset.list({ screenKey: "statistics" }))[0]?.payload
	).toEqual(payload);
	const updatedPayload = {
		...payload,
		valuation: "virtual" as const,
		entryTagIds: [...payload.entryTagIds],
		tournamentTagIds: [...payload.tournamentTagIds],
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
		.values({ id: "bob-room", userId: "bob", name: "Room" });
	await api.db
		.insert(asset)
		.values({ id: "bob-asset", userId: "bob", name: "Asset" });
	await api.db
		.insert(entryTag)
		.values({ id: "bob-entry-tag", userId: "bob", name: "Entry" });
	await api.db
		.insert(tournamentTag)
		.values({ id: "bob-tournament-tag", userId: "bob", name: "Tournament" });
	const created = requireCreatedRow(
		await api.alice.filterPreset.create({
			screenKey: "sessions",
			name: "Owned",
			payload: {},
		})
	);
	const before = await api.db.select().from(filterPreset);
	for (const payload of [
		{ roomId: "bob-room" },
		{ assetId: "bob-asset" },
		{ valuation: "real" as const, baseAssetId: "bob-asset" },
		{ entryTagIds: ["bob-entry-tag"] },
		{ tournamentTagIds: ["bob-tournament-tag"] },
	]) {
		await expect(
			api.alice.filterPreset.create({
				screenKey: "sessions",
				name: "Foreign",
				payload,
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
		.values({ id: "item", userId: "alice", name: "Item", kind: "item" });
	await expect(
		api.alice.filterPreset.create({
			screenKey: "statistics",
			name: "Invalid",
			payload: { valuation: "real", baseAssetId: "item" },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await api.db.insert(filterPreset).values({
		id: "invalid-preset",
		userId: "alice",
		screenKey: "statistics",
		name: "Legacy",
		payload: sql`'{"norm":"off"}'`,
	});
	await expect(
		api.alice.filterPreset.list({ screenKey: "statistics" })
	).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
});
