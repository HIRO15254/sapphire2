import { describe, expect, it } from "vitest";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
} from "../constants/game-variants";

describe("DEFAULT_GAME_GROUPS", () => {
	it("has exactly 3 groups", () => {
		expect(DEFAULT_GAME_GROUPS).toHaveLength(3);
	});

	it("has unique keys", () => {
		const keys = DEFAULT_GAME_GROUPS.map((g) => g.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("orders groups limit -> stud -> bigbet (structure-sheet convention)", () => {
		expect(DEFAULT_GAME_GROUPS.map((g) => g.key)).toEqual([
			"limit",
			"stud",
			"bigbet",
		]);
	});

	it("has a non-empty label for every group", () => {
		for (const g of DEFAULT_GAME_GROUPS) {
			expect(g.label.length, g.key).toBeGreaterThan(0);
		}
	});

	it("built-in structures carry the Must / Optional blind fields of the spec", () => {
		expect(DEFAULT_GAME_GROUPS).toEqual([
			{
				key: "limit",
				label: "Limit",
				blind1Label: "Small Bet",
				blind1Required: true,
				blind2Label: "Big Bet",
				blind2Required: true,
				blind3Label: null,
				blind3Required: false,
			},
			{
				key: "stud",
				label: "Stud",
				blind1Label: "Small Bet",
				blind1Required: true,
				blind2Label: "Big Bet",
				blind2Required: true,
				blind3Label: "Bring-in",
				blind3Required: false,
			},
			{
				key: "bigbet",
				label: "Big Bet",
				blind1Label: "SB",
				blind1Required: true,
				blind2Label: "BB",
				blind2Required: true,
				blind3Label: null,
				blind3Required: false,
			},
		]);
	});
});

describe("DEFAULT_GAME_VARIANTS", () => {
	it("has exactly 21 entries", () => {
		expect(DEFAULT_GAME_VARIANTS).toHaveLength(21);
	});

	it("has unique keys", () => {
		const keys = DEFAULT_GAME_VARIANTS.map((v) => v.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("has unique labels", () => {
		const labels = DEFAULT_GAME_VARIANTS.map((v) => v.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("has unique shortLabels", () => {
		const shortLabels = DEFAULT_GAME_VARIANTS.map((v) => v.shortLabel);
		expect(new Set(shortLabels).size).toBe(shortLabels.length);
	});

	it("every entry has a valid groupKey", () => {
		const validGroupKeys = new Set(DEFAULT_GAME_GROUPS.map((g) => g.key));
		for (const v of DEFAULT_GAME_VARIANTS) {
			expect(validGroupKeys.has(v.groupKey), v.key).toBe(true);
		}
	});

	it("every entry has non-empty label / shortLabel", () => {
		for (const v of DEFAULT_GAME_VARIANTS) {
			expect(v.label.length, `${v.key}.label`).toBeGreaterThan(0);
			expect(v.shortLabel.length, `${v.key}.shortLabel`).toBeGreaterThan(0);
		}
	});

	it("sortOrder is implicit via array index — has the exact key order", () => {
		expect(DEFAULT_GAME_VARIANTS.map((v) => v.key)).toEqual([
			"nlh",
			"plhe",
			"plo",
			"plo5",
			"plo8",
			"bigo",
			"shortdeck",
			"27sd",
			"pl27td",
			"courchevel",
			"lhe",
			"lo",
			"o8",
			"27td",
			"a5td",
			"badugi",
			"badeucy",
			"badacy",
			"stud",
			"stud8",
			"razz",
		]);
	});

	it("renames plo8 to 'Pot Limit Omaha Hi-Lo'", () => {
		const plo8 = DEFAULT_GAME_VARIANTS.find((v) => v.key === "plo8");
		expect(plo8?.label).toBe("Pot Limit Omaha Hi-Lo");
		expect(plo8?.shortLabel).toBe("PLO8");
		expect(plo8?.groupKey).toBe("bigbet");
	});

	it("renames o8 to 'Limit Omaha Hi-Lo'", () => {
		const o8 = DEFAULT_GAME_VARIANTS.find((v) => v.key === "o8");
		expect(o8?.label).toBe("Limit Omaha Hi-Lo");
		expect(o8?.shortLabel).toBe("O8");
		expect(o8?.groupKey).toBe("limit");
	});

	it("renames 27td to 'Limit 2-7 Triple Draw'", () => {
		const td = DEFAULT_GAME_VARIANTS.find((v) => v.key === "27td");
		expect(td?.label).toBe("Limit 2-7 Triple Draw");
		expect(td?.shortLabel).toBe("2-7TD");
		expect(td?.groupKey).toBe("limit");
	});

	it("bucketizes bigbet variants correctly", () => {
		const bigbetKeys = DEFAULT_GAME_VARIANTS.filter(
			(v) => v.groupKey === "bigbet"
		).map((v) => v.key);
		expect(bigbetKeys.sort()).toEqual(
			[
				"nlh",
				"plhe",
				"plo",
				"plo5",
				"plo8",
				"bigo",
				"shortdeck",
				"27sd",
				"pl27td",
				"courchevel",
			].sort()
		);
	});

	it("bucketizes limit variants correctly", () => {
		const limitKeys = DEFAULT_GAME_VARIANTS.filter(
			(v) => v.groupKey === "limit"
		).map((v) => v.key);
		expect(limitKeys.sort()).toEqual(
			["lhe", "lo", "o8", "27td", "a5td", "badugi", "badeucy", "badacy"].sort()
		);
	});

	it("bucketizes stud variants correctly", () => {
		const studKeys = DEFAULT_GAME_VARIANTS.filter(
			(v) => v.groupKey === "stud"
		).map((v) => v.key);
		expect(studKeys.sort()).toEqual(["stud", "stud8", "razz"].sort());
	});
});

describe("DEFAULT_GAME_MIXES", () => {
	it("has exactly 3 mixes", () => {
		expect(DEFAULT_GAME_MIXES).toHaveLength(3);
	});

	it("has unique keys", () => {
		const keys = DEFAULT_GAME_MIXES.map((m) => m.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("has unique labels", () => {
		const labels = DEFAULT_GAME_MIXES.map((m) => m.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("every variantKeys entry exists in DEFAULT_GAME_VARIANTS keys", () => {
		const validVariantKeys = new Set(DEFAULT_GAME_VARIANTS.map((v) => v.key));
		for (const m of DEFAULT_GAME_MIXES) {
			for (const key of m.variantKeys) {
				expect(validVariantKeys.has(key), `${m.key} -> ${key}`).toBe(true);
			}
		}
	});

	it("has a non-empty variantKeys array for every mix", () => {
		for (const m of DEFAULT_GAME_MIXES) {
			expect(m.variantKeys.length, m.key).toBeGreaterThan(0);
		}
	});

	it("has the expected key order horse -> 8game -> 10game", () => {
		expect(DEFAULT_GAME_MIXES.map((m) => m.key)).toEqual([
			"horse",
			"8game",
			"10game",
		]);
	});

	it("HORSE composes lhe/o8/razz/stud/stud8", () => {
		const horse = DEFAULT_GAME_MIXES.find((m) => m.key === "horse");
		expect(horse?.label).toBe("HORSE");
		expect(horse?.variantKeys).toEqual(["lhe", "o8", "razz", "stud", "stud8"]);
	});

	it("8-Game composes 8 variants", () => {
		const eightGame = DEFAULT_GAME_MIXES.find((m) => m.key === "8game");
		expect(eightGame?.label).toBe("8-Game");
		expect(eightGame?.variantKeys).toHaveLength(8);
	});

	it("10-Game composes 10 variants", () => {
		const tenGame = DEFAULT_GAME_MIXES.find((m) => m.key === "10game");
		expect(tenGame?.label).toBe("10-Game");
		expect(tenGame?.variantKeys).toHaveLength(10);
	});
});
