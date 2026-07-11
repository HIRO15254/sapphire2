import { describe, expect, it } from "vitest";
import {
	GAME_VARIANTS,
	isMixVariant,
	resolveBlindLabels,
	variantShortLabel,
} from "../constants/game-variants";

describe("GAME_VARIANTS", () => {
	it("has a non-empty label and shortLabel for every preset", () => {
		for (const [key, def] of Object.entries(GAME_VARIANTS)) {
			expect(def.label.length, `${key}.label`).toBeGreaterThan(0);
			expect(def.shortLabel.length, `${key}.shortLabel`).toBeGreaterThan(0);
		}
	});

	it("marks the stud family (stud, stud8, razz) with a Bring-in third blind label", () => {
		expect(GAME_VARIANTS.stud.blindLabels.blind3).toBe("Bring-in");
		expect(GAME_VARIANTS.stud8.blindLabels.blind3).toBe("Bring-in");
		expect(GAME_VARIANTS.razz.blindLabels.blind3).toBe("Bring-in");
	});

	it("marks the limit family (lhe, o8, 27td, badugi) with no third blind slot", () => {
		expect(GAME_VARIANTS.lhe.blindLabels.blind3).toBeNull();
		expect(GAME_VARIANTS.o8.blindLabels.blind3).toBeNull();
		expect(GAME_VARIANTS["27td"].blindLabels.blind3).toBeNull();
		expect(GAME_VARIANTS.badugi.blindLabels.blind3).toBeNull();
	});

	it("gives shortdeck an Ante/Button pair with no third blind slot", () => {
		expect(GAME_VARIANTS.shortdeck.blindLabels).toEqual({
			blind1: "Ante",
			blind2: "Button",
			blind3: null,
		});
	});

	it("marks only 'mix' as isMix", () => {
		for (const [key, def] of Object.entries(GAME_VARIANTS)) {
			expect(def.isMix, key).toBe(key === "mix");
		}
	});

	it("has exactly the 15 documented preset keys", () => {
		expect(Object.keys(GAME_VARIANTS).sort()).toEqual(
			[
				"27sd",
				"27td",
				"badugi",
				"bigo",
				"lhe",
				"mix",
				"nlh",
				"o8",
				"plo",
				"plo5",
				"plo8",
				"razz",
				"shortdeck",
				"stud",
				"stud8",
			].sort()
		);
	});
});

describe("resolveBlindLabels", () => {
	it("returns the preset's own blindLabels for a known variant key", () => {
		expect(resolveBlindLabels("nlh")).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});

	it("returns the preset's blindLabels for a variant with no third blind slot", () => {
		expect(resolveBlindLabels("lhe")).toEqual({
			blind1: "Small Bet",
			blind2: "Big Bet",
			blind3: null,
		});
	});

	it("returns the preset's blindLabels for shortdeck even when custom labels are supplied", () => {
		// Preset resolution takes priority over custom labels.
		expect(
			resolveBlindLabels("shortdeck", {
				blind1Label: "Custom1",
				blind2Label: "Custom2",
				blind3Label: "Custom3",
			})
		).toEqual({ blind1: "Ante", blind2: "Button", blind3: null });
	});

	it("uses the provided custom labels when the variant is not a preset", () => {
		expect(
			resolveBlindLabels("My Custom Mix", {
				blind1Label: "Ante 1",
				blind2Label: "Ante 2",
				blind3Label: "Ante 3",
			})
		).toEqual({ blind1: "Ante 1", blind2: "Ante 2", blind3: "Ante 3" });
	});

	it("falls back to SB/BB when custom blind1Label/blind2Label are null", () => {
		expect(
			resolveBlindLabels("My Custom Mix", {
				blind1Label: null,
				blind2Label: null,
				blind3Label: null,
			})
		).toEqual({ blind1: "SB", blind2: "BB", blind3: null });
	});

	it("keeps custom blind3Label null as null rather than defaulting it", () => {
		const result = resolveBlindLabels("My Custom Mix", {
			blind1Label: "SB2",
			blind2Label: "BB2",
			blind3Label: null,
		});
		expect(result.blind3).toBeNull();
	});

	it("falls back to SB/BB/Straddle defaults for an unknown variant with no custom labels", () => {
		expect(resolveBlindLabels("some-unknown-variant")).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});

	it("falls back to SB/BB/Straddle defaults when custom is explicitly null", () => {
		expect(resolveBlindLabels("some-unknown-variant", null)).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});
});

describe("variantShortLabel", () => {
	it("returns the preset shortLabel for a known variant key", () => {
		expect(variantShortLabel("nlh")).toBe("NLH");
		expect(variantShortLabel("plo")).toBe("PLO");
		expect(variantShortLabel("mix")).toBe("Mix");
	});

	it("passes through an unknown variant string unchanged (no uppercasing)", () => {
		expect(variantShortLabel("Custom Game")).toBe("Custom Game");
	});

	it("passes through an empty string unchanged", () => {
		expect(variantShortLabel("")).toBe("");
	});
});

describe("isMixVariant", () => {
	it("returns true for the mix preset", () => {
		expect(isMixVariant("mix")).toBe(true);
	});

	it("returns false for a non-mix preset (nlh)", () => {
		expect(isMixVariant("nlh")).toBe(false);
	});

	it("returns false for an unknown variant string", () => {
		expect(isMixVariant("some-unknown-variant")).toBe(false);
	});
});
