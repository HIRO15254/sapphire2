import { gameGroup } from "@sapphire2/db/schema/game-group";
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
			key: "orphan",
			label: "Orphan Variant",
			shortLabel: "ORP",
			groupKey: "no-such-group",
		},
	],
	DEFAULT_GAME_MIXES: [],
}));

const USER_ID = "user-1";
const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);

function emptyAccountDb() {
	return createChainableMockDb({
		select: { [GROUP_TABLE]: [], [VARIANT_TABLE]: [] },
	});
}

describe("seedDefaultGameData with a variant whose groupKey resolves to no group", () => {
	it("skips the orphan variant while still seeding the group", async () => {
		const { db, inserted } = emptyAccountDb();

		await seedDefaultGameData(db, USER_ID);

		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(
			(inserted[GROUP_TABLE] as Record<string, unknown>[]).map(
				(row) => row.builtinKey
			)
		).toEqual(["limit"]);
	});
});
