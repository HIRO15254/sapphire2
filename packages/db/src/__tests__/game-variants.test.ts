import { describe, expect, it } from "vitest";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_VARIANTS,
	isMixVariant,
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
	variantDisplayLabel,
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

	it("limit group uses Small Bet / Big Bet with no third blind slot", () => {
		const limit = DEFAULT_GAME_GROUPS.find((g) => g.key === "limit");
		expect(limit).toEqual({
			key: "limit",
			label: "Limit",
			blind1Label: "Small Bet",
			blind2Label: "Big Bet",
			blind3Label: null,
		});
	});

	it("stud group uses Small Bet / Big Bet / Bring-in", () => {
		const stud = DEFAULT_GAME_GROUPS.find((g) => g.key === "stud");
		expect(stud).toEqual({
			key: "stud",
			label: "Stud",
			blind1Label: "Small Bet",
			blind2Label: "Big Bet",
			blind3Label: "Bring-in",
		});
	});

	it("bigbet group uses SB / BB / Straddle", () => {
		const bigbet = DEFAULT_GAME_GROUPS.find((g) => g.key === "bigbet");
		expect(bigbet).toEqual({
			key: "bigbet",
			label: "Big Bet",
			blind1Label: "SB",
			blind2Label: "BB",
			blind3Label: "Straddle",
		});
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

describe("MIX_VARIANT constants", () => {
	it("MIX_VARIANT is the fixed key 'mix'", () => {
		expect(MIX_VARIANT).toBe("mix");
	});

	it("MIX_VARIANT_LABEL is 'Mixed Game'", () => {
		expect(MIX_VARIANT_LABEL).toBe("Mixed Game");
	});
});

describe("isMixVariant", () => {
	it("returns true for the mix key", () => {
		expect(isMixVariant("mix")).toBe(true);
	});

	it("returns false for a display label (self-frozen variant string)", () => {
		expect(isMixVariant("NL Hold'em")).toBe(false);
	});

	it("returns false for an empty string", () => {
		expect(isMixVariant("")).toBe(false);
	});

	it("returns false for the mix display label itself", () => {
		expect(isMixVariant("Mixed Game")).toBe(false);
	});
});

describe("variantDisplayLabel", () => {
	it("maps the mix key to 'Mixed Game'", () => {
		expect(variantDisplayLabel("mix")).toBe("Mixed Game");
	});

	it("passes through any other stored label verbatim (self-freezing)", () => {
		expect(variantDisplayLabel("NL Hold'em")).toBe("NL Hold'em");
	});

	it("passes through an empty string unchanged", () => {
		expect(variantDisplayLabel("")).toBe("");
	});

	it("passes through a user-defined custom variant label unchanged", () => {
		expect(variantDisplayLabel("My House Mix")).toBe("My House Mix");
	});
});
