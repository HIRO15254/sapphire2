import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { seedDefaultGameData } from "../services/seed-game-data";
import { createChainableMockDb } from "./test-utils";

// A dedicated file because it replaces the seed constants module-wide: the
// point is a builtin mix wide enough to overflow D1's 100-bind-param cap in a
// single INSERT, which the real DEFAULT_GAME_MIXES (max 10 variants) cannot
// express.
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
	DEFAULT_GAME_VARIANTS: Array.from({ length: 30 }, (_, index) => ({
		key: `v${index}`,
		label: `Variant ${index}`,
		shortLabel: `V${index}`,
		groupKey: "limit",
	})),
	DEFAULT_GAME_MIXES: [
		{
			key: "wide",
			label: "Wide",
			variantKeys: Array.from({ length: 30 }, (_, index) => `v${index}`),
		},
	],
}));

const USER_ID = "user-1";
const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_VARIANT_TABLE = "game_mix_variant";

function seedWideMix() {
	const mock = createChainableMockDb({
		select: { [GROUP_TABLE]: [], [VARIANT_TABLE]: [] },
	});
	return mock;
}

function membershipChunks(inserted: Record<string, unknown[]>) {
	return (inserted[MIX_VARIANT_TABLE] ?? []).map((entry) =>
		Array.isArray(entry) ? entry : [entry]
	) as Record<string, unknown>[][];
}

describe("seedDefaultGameData membership chunking (D1 100-bind-param cap)", () => {
	it("splits a 30-variant builtin mix across INSERTs that stay under the cap", async () => {
		const { db, inserted } = seedWideMix();

		await seedDefaultGameData(db, USER_ID);

		const chunks = membershipChunks(inserted);
		const columnsPerRow = Object.keys(chunks[0]?.[0] ?? {}).length;
		expect(columnsPerRow).toBeGreaterThan(0);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length * columnsPerRow).toBeLessThanOrEqual(100);
		}
	});

	it("preserves the full composition and its positions across the chunk boundary", async () => {
		const { db, inserted } = seedWideMix();

		await seedDefaultGameData(db, USER_ID);

		const memberships = membershipChunks(inserted).flat();
		expect(memberships.map((row) => row.position)).toEqual(
			Array.from({ length: 30 }, (_, index) => index)
		);
		expect(memberships.map((row) => row.variantId)).toEqual(
			Array.from(
				{ length: 30 },
				(_, index) => `${USER_ID}:builtin-variant:v${index}`
			)
		);
		expect(memberships.every((row) => row.userId === USER_ID)).toBe(true);
	});
});
