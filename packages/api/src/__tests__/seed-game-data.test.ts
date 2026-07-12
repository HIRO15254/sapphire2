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

	it("commits every insert in a single db.batch call (atomic seed, SA2-116)", async () => {
		const { db, batch } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		expect(batch).toHaveBeenCalledTimes(1);
		const [statements] = batch.mock.calls[0] as [unknown[]];
		expect(statements).toHaveLength(27);
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

	it("seeds groups with builtinKey/label/blind labels from DEFAULT_GAME_GROUPS", async () => {
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

	it("resolves each mix's games array to this user's seeded variant ids, in order", async () => {
		const { db, inserted } = emptyAccountDb();
		await seedDefaultGameData(db, USER_ID);
		const variantRows = inserted[VARIANT_TABLE] as Record<string, unknown>[];
		const mixRows = inserted[MIX_TABLE] as Record<string, unknown>[];
		const variantIdByKey = new Map(
			variantRows.map((v) => [v.builtinKey as string, v.id as string])
		);
		for (const def of DEFAULT_GAME_MIXES) {
			const row = mixRows.find((r) => r.builtinKey === def.key);
			const expectedIds = def.variantKeys.map((key) => variantIdByKey.get(key));
			expect(row?.games).toEqual(expectedIds);
		}
	});
});
