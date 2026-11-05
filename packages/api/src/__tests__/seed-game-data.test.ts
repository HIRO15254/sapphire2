import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { seedDefaultGameData } from "../services/seed-game-data";
import { createChainableMockDb } from "./test-utils";

const USER_ID = "user-1";
const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);
const MIX_VARIANT_TABLE = "game_mix_variant";

function flattenedWrites(
	writes: unknown[] | undefined
): Record<string, unknown>[] {
	return (writes ?? []).flatMap((entry) =>
		Array.isArray(entry) ? entry : [entry]
	) as Record<string, unknown>[];
}

function emptyAccountDb() {
	return createChainableMockDb({
		select: { [GROUP_TABLE]: [], [VARIANT_TABLE]: [] },
	});
}

describe("seedDefaultGameData", () => {
	it("seeds exactly 3 groups, 21 variants, and 3 mixes into an empty account", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		expect(inserted[GROUP_TABLE]).toHaveLength(3);
		expect(inserted[VARIANT_TABLE]).toHaveLength(21);
		expect(inserted[MIX_TABLE]).toHaveLength(3);
	});

	it("stamps every seeded group, variant, and mix with the caller's userId", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		for (const row of inserted[GROUP_TABLE] as Record<string, unknown>[]) {
			expect(row.userId).toBe(USER_ID);
		}
		for (const row of inserted[VARIANT_TABLE] as Record<string, unknown>[]) {
			expect(row.userId).toBe(USER_ID);
		}
		for (const row of inserted[MIX_TABLE] as Record<string, unknown>[]) {
			expect(row.userId).toBe(USER_ID);
		}
	});

	it("seeds groups with builtinKey/label/blind labels and required flags from DEFAULT_GAME_GROUPS", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const rows = inserted[GROUP_TABLE] as Record<string, unknown>[];
		for (const def of DEFAULT_GAME_GROUPS) {
			const row = rows.find((r) => r.builtinKey === def.key);
			expect(row, def.key).toBeDefined();
			expect(row?.label).toBe(def.label);
			expect(row?.blind1Label).toBe(def.blind1Label);
			expect(row?.blind2Label).toBe(def.blind2Label);
			expect(row?.blind3Label).toBe(def.blind3Label);
			expect(row?.blind1Required).toBe(def.blind1Required);
			expect(row?.blind2Required).toBe(def.blind2Required);
			expect(row?.blind3Required).toBe(def.blind3Required);
			expect(typeof row?.id).toBe("string");
			expect((row?.id as string).length).toBeGreaterThan(0);
		}
	});

	it("seeds variants with builtinKey/label/shortLabel and sortOrder = array index", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const rows = inserted[VARIANT_TABLE] as Record<string, unknown>[];
		DEFAULT_GAME_VARIANTS.forEach((def, index) => {
			const row = rows.find((r) => r.builtinKey === def.key);
			expect(row, def.key).toBeDefined();
			expect(row?.label).toBe(def.label);
			expect(row?.shortLabel).toBe(def.shortLabel);
			expect(row?.sortOrder).toBe(index);
			expect(typeof row?.id).toBe("string");
		});
	});

	it("assigns each variant's groupId to the seeded group matching its groupKey", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const groupRows = inserted[GROUP_TABLE] as Record<string, unknown>[];
		const variantRows = inserted[VARIANT_TABLE] as Record<string, unknown>[];
		const groupIdByBuiltinKey = new Map(
			groupRows.map((g) => [g.builtinKey as string, g.id as string])
		);
		for (const def of DEFAULT_GAME_VARIANTS) {
			const row = variantRows.find((r) => r.builtinKey === def.key);
			expect(row?.groupId).toBe(groupIdByBuiltinKey.get(def.groupKey));
		}
	});

	it("skips entirely when the user already has a gameGroup row (respects intentional deletion)", async () => {
		const { db, batch, inserted } = createChainableMockDb({
			select: {
				[GROUP_TABLE]: [{ id: "g-1", userId: USER_ID }],
				[VARIANT_TABLE]: [],
			},
		});
		await seedDefaultGameData(db, USER_ID);
		expect(batch).not.toHaveBeenCalled();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(inserted[MIX_TABLE]).toBeUndefined();
	});

	it("skips entirely when the user already has a gameVariant row but no group", async () => {
		const { db, batch, inserted } = createChainableMockDb({
			select: {
				[GROUP_TABLE]: [],
				[VARIANT_TABLE]: [{ id: "v-1", userId: USER_ID }],
			},
		});
		await seedDefaultGameData(db, USER_ID);
		expect(batch).not.toHaveBeenCalled();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(inserted[MIX_TABLE]).toBeUndefined();
	});

	it("skips entirely when the user already has a gameMix row but no group or variant (c09)", async () => {
		const { db, batch, inserted } = createChainableMockDb({
			select: {
				[GROUP_TABLE]: [],
				[VARIANT_TABLE]: [],
				[MIX_TABLE]: [{ id: "m-1", userId: USER_ID }],
			},
		});
		await seedDefaultGameData(db, USER_ID);
		expect(batch).not.toHaveBeenCalled();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(inserted[MIX_TABLE]).toBeUndefined();
	});

	it("seeds mixes with builtinKey/label from DEFAULT_GAME_MIXES", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const rows = inserted[MIX_TABLE] as Record<string, unknown>[];
		expect(rows).toHaveLength(3);
		for (const def of DEFAULT_GAME_MIXES) {
			const row = rows.find((r) => r.builtinKey === def.key);
			expect(row, def.key).toBeDefined();
			expect(row?.label).toBe(def.label);
			expect(typeof row?.id).toBe("string");
			expect((row?.id as string).length).toBeGreaterThan(0);
		}
	});

	it("stores each mix's seeded variant ids in junction position order", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const variantRows = inserted[VARIANT_TABLE] as Record<string, unknown>[];
		const mixRows = inserted[MIX_TABLE] as Record<string, unknown>[];
		const memberships = flattenedWrites(inserted[MIX_VARIANT_TABLE]);
		const variantIdByKey = new Map(
			variantRows.map((v) => [v.builtinKey as string, v.id as string])
		);
		for (const def of DEFAULT_GAME_MIXES) {
			const mix = mixRows.find((row) => row.builtinKey === def.key) as {
				id: string;
			};
			const orderedIds = memberships
				.filter((row) => row.mixId === mix.id)
				.toSorted(
					(left, right) =>
						(left.position as number) - (right.position as number)
				)
				.map((row) => row.variantId);
			expect(orderedIds).toEqual(
				def.variantKeys.map((key) => variantIdByKey.get(key))
			);
		}
	});

	it("uses stable built-in ids so concurrent seed batches share the same foreign-key targets", async () => {
		const first = emptyAccountDb();
		const second = emptyAccountDb();

		await seedDefaultGameData(first.db, USER_ID);
		await seedDefaultGameData(second.db, USER_ID);

		expect(
			flattenedWrites(second.inserted[GROUP_TABLE]).map(
				({ builtinKey, id }) => ({
					builtinKey,
					id,
				})
			)
		).toEqual(
			flattenedWrites(first.inserted[GROUP_TABLE]).map(
				({ builtinKey, id }) => ({
					builtinKey,
					id,
				})
			)
		);
		expect(
			flattenedWrites(second.inserted[VARIANT_TABLE]).map(
				({ builtinKey, groupId, id }) => ({ builtinKey, groupId, id })
			)
		).toEqual(
			flattenedWrites(first.inserted[VARIANT_TABLE]).map(
				({ builtinKey, groupId, id }) => ({ builtinKey, groupId, id })
			)
		);
		expect(
			flattenedWrites(second.inserted[MIX_TABLE]).map(({ builtinKey, id }) => ({
				builtinKey,
				id,
			}))
		).toEqual(
			flattenedWrites(first.inserted[MIX_TABLE]).map(({ builtinKey, id }) => ({
				builtinKey,
				id,
			}))
		);
		expect(flattenedWrites(second.inserted[MIX_VARIANT_TABLE])).toEqual(
			flattenedWrites(first.inserted[MIX_VARIANT_TABLE])
		);
	});

	it("propagates batch failures including former label-trigger errors", async () => {
		const { db, batch } = emptyAccountDb();
		for (const message of [
			"D1_ERROR: database is locked",
			"game_group label already exists",
		]) {
			batch.mockRejectedValueOnce(new Error(message));
			await expect(seedDefaultGameData(db, USER_ID)).rejects.toThrow(message);
		}
	});

	it("keeps stable built-in ids isolated between users", async () => {
		const first = emptyAccountDb();
		const second = emptyAccountDb();

		await seedDefaultGameData(first.db, USER_ID);
		await seedDefaultGameData(second.db, "user-2");

		const firstIds = new Set(
			[
				...(first.inserted[GROUP_TABLE] ?? []),
				...(first.inserted[VARIANT_TABLE] ?? []),
				...(first.inserted[MIX_TABLE] ?? []),
			].map((row) => (row as { id: string }).id)
		);
		const secondIds = [
			...(second.inserted[GROUP_TABLE] ?? []),
			...(second.inserted[VARIANT_TABLE] ?? []),
			...(second.inserted[MIX_TABLE] ?? []),
		].map((row) => (row as { id: string }).id);

		expect(secondIds.every((id) => !firstIds.has(id))).toBe(true);
	});
});
