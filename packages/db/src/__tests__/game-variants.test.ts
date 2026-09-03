import { describe, expect, it } from "vitest";
import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_GAME_MIXES,
	DEFAULT_GAME_VARIANTS,
	DEFAULT_VARIANT_LABEL,
	isMixVariant,
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
	variantDisplayLabel,
} from "../constants/game-variants";

describe("DEFAULT_VARIANT_LABEL", () => {
	it("matches the seeded NLH row's label (form-default variant)", () => {
		const nlh = DEFAULT_GAME_VARIANTS.find((v) => v.key === "nlh");
		expect(DEFAULT_VARIANT_LABEL).toBe(nlh?.label);
	});
});

describe("builtin seed identity", () => {
	it("gives every variant a unique key (seed id suffix)", () => {
		const keys = DEFAULT_GAME_VARIANTS.map((v) => v.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every group a unique key (seed id suffix)", () => {
		const keys = DEFAULT_GAME_GROUPS.map((g) => g.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every mix a unique key (seed id suffix)", () => {
		const keys = DEFAULT_GAME_MIXES.map((m) => m.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every variant a unique label (seed insert conflict surface)", () => {
		const labels = DEFAULT_GAME_VARIANTS.map((v) => v.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it("resolves every variant's groupKey to a seeded group", () => {
		const groupKeys = new Set(DEFAULT_GAME_GROUPS.map((g) => g.key));
		const unresolved = DEFAULT_GAME_VARIANTS.filter(
			(v) => !groupKeys.has(v.groupKey)
		).map((v) => v.key);
		expect(unresolved).toEqual([]);
	});

	it("resolves every mix's variantKeys to seeded variants", () => {
		const variantKeys = new Set(DEFAULT_GAME_VARIANTS.map((v) => v.key));
		const unresolved = DEFAULT_GAME_MIXES.flatMap((m) =>
			m.variantKeys
				.filter((key) => !variantKeys.has(key))
				.map((key) => ({
					mix: m.key,
					variantKey: key,
				}))
		);
		expect(unresolved).toEqual([]);
	});
});

describe("isMixVariant", () => {
	it("returns true for the mix sentinel", () => {
		expect(isMixVariant(MIX_VARIANT)).toBe(true);
	});

	it.each([
		DEFAULT_VARIANT_LABEL,
		MIX_VARIANT_LABEL,
		"",
	])("returns false for a stored label or empty string (%s)", (variant) => {
		expect(isMixVariant(variant)).toBe(false);
	});
});

describe("variantDisplayLabel", () => {
	it("maps the mix sentinel to the mix display label", () => {
		expect(variantDisplayLabel(MIX_VARIANT)).toBe(MIX_VARIANT_LABEL);
	});

	it.each([
		DEFAULT_VARIANT_LABEL,
		"My House Mix",
		"",
	])("passes a stored label through verbatim (%s)", (variant) => {
		expect(variantDisplayLabel(variant)).toBe(variant);
	});
});
