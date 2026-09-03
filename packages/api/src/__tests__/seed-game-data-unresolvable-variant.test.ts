import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { seedDefaultGameData } from "../services/seed-game-data";
import { createChainableMockDb } from "./test-utils";

vi.mock("@sapphire2/db/constants/game-variants", () => ({
	DEFAULT_GAME_GROUPS: [
		{
			key: "limit",
			label: "Limit",
			blind1Label: "Small Bet",
			blind2Label: "Big Bet",
			blind3Label: null,
		},
	],
	DEFAULT_GAME_VARIANTS: [
		{
			key: "lhe",
			label: "Limit Hold'em",
			shortLabel: "LHE",
			groupKey: "limit",
		},
	],
	DEFAULT_GAME_MIXES: [
		{ key: "solo", label: "Solo", variantKeys: ["lhe"] },
		{ key: "ghost", label: "Ghost", variantKeys: ["not-seeded"] },
		{ key: "partial", label: "Partial", variantKeys: ["not-seeded", "lhe"] },
	],
}));

const USER_ID = "user-1";
const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);
const MIX_VARIANT_TABLE = "game_mix_variant";

function emptyAccountDb() {
	return createChainableMockDb({
		select: { [GROUP_TABLE]: [], [VARIANT_TABLE]: [] },
	});
}

function membershipRows(inserted: Record<string, unknown[]>) {
	return (inserted[MIX_VARIANT_TABLE] ?? []).flatMap((entry) =>
		Array.isArray(entry) ? entry : [entry]
	) as Record<string, unknown>[];
}

describe("seedDefaultGameData with an unresolvable mix variantKey", () => {
	it("never emits an insert with zero membership rows (Drizzle throws on values([]))", async () => {
		const { db, inserted } = emptyAccountDb();

		await seedDefaultGameData(db, USER_ID);

		for (const write of inserted[MIX_VARIANT_TABLE] ?? []) {
			expect(Array.isArray(write) ? write : [write]).not.toHaveLength(0);
		}
	});

	it("still seeds the mix master row whose composition resolved to nothing", async () => {
		const { db, inserted } = emptyAccountDb();

		await seedDefaultGameData(db, USER_ID);

		const mixes = inserted[MIX_TABLE] as Record<string, unknown>[];
		expect(mixes.map((row) => row.builtinKey)).toEqual([
			"solo",
			"ghost",
			"partial",
		]);
		expect(
			membershipRows(inserted).map((row) => row.mixId as string)
		).not.toContain(`${USER_ID}:builtin-mix:ghost`);
	});

	it("seeds the resolvable subset of a partially resolvable mix at dense positions", async () => {
		const { db, inserted } = emptyAccountDb();

		await seedDefaultGameData(db, USER_ID);

		expect(
			membershipRows(inserted).filter(
				(row) => row.mixId === `${USER_ID}:builtin-mix:partial`
			)
		).toEqual([
			{
				mixId: `${USER_ID}:builtin-mix:partial`,
				position: 0,
				userId: USER_ID,
				variantId: `${USER_ID}:builtin-variant:lhe`,
			},
		]);
	});

	it("batches one statement per emitted write and resolves without throwing", async () => {
		const { db, batch } = emptyAccountDb();

		await expect(seedDefaultGameData(db, USER_ID)).resolves.toBeUndefined();
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(10);
	});

	it("still mirrors an empty composition into the legacy games column", async () => {
		const { db, updated } = emptyAccountDb();

		await seedDefaultGameData(db, USER_ID);

		expect(
			(updated[MIX_TABLE] as Record<string, unknown>[]).map((row) => row.games)
		).toEqual([
			[`${USER_ID}:builtin-variant:lhe`],
			[],
			[`${USER_ID}:builtin-variant:lhe`],
		]);
	});
});
