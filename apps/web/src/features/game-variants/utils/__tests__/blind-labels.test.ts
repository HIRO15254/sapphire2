import { describe, expect, it } from "vitest";
import {
	DEFAULT_BLIND_LABELS,
	resolveBlindLabels,
} from "@/features/game-variants/utils/blind-labels";

interface VariantLike {
	blindLabel1: string | null;
	blindLabel2: string | null;
	blindLabel3: string | null;
	name: string;
}

function variant(overrides: Partial<VariantLike> = {}): VariantLike {
	return {
		name: "NLH",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		...overrides,
	};
}

describe("resolveBlindLabels", () => {
	it("returns the matching variant's three blind labels on an exact name match", () => {
		const variants = [
			variant({ name: "NLH" }),
			variant({
				name: "Short Deck",
				blindLabel1: "Button blind",
				blindLabel2: null,
				blindLabel3: null,
			}),
		];
		expect(resolveBlindLabels("Short Deck", variants)).toEqual({
			blind1: "Button blind",
			blind2: null,
			blind3: null,
		});
	});

	it("matches case-insensitively", () => {
		const variants = [
			variant({
				name: "PLO5",
				blindLabel1: "SB",
				blindLabel2: "BB",
				blindLabel3: "Straddle",
			}),
		];
		expect(resolveBlindLabels("plo5", variants)).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
		expect(resolveBlindLabels("PLO5", variants)).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
		expect(resolveBlindLabels("Plo5", variants)).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});

	it("returns DEFAULT_BLIND_LABELS when no variant name matches", () => {
		const variants = [variant({ name: "NLH" })];
		expect(resolveBlindLabels("PLO", variants)).toBe(DEFAULT_BLIND_LABELS);
	});

	it("returns DEFAULT_BLIND_LABELS when variantName is null", () => {
		const variants = [variant({ name: "NLH" })];
		expect(resolveBlindLabels(null, variants)).toBe(DEFAULT_BLIND_LABELS);
	});

	it("returns DEFAULT_BLIND_LABELS when variantName is undefined", () => {
		const variants = [variant({ name: "NLH" })];
		expect(resolveBlindLabels(undefined, variants)).toBe(DEFAULT_BLIND_LABELS);
	});

	it("returns DEFAULT_BLIND_LABELS when variantName is an empty string", () => {
		const variants = [variant({ name: "NLH" })];
		expect(resolveBlindLabels("", variants)).toBe(DEFAULT_BLIND_LABELS);
	});

	it("returns DEFAULT_BLIND_LABELS when the variants list is empty", () => {
		expect(resolveBlindLabels("NLH", [])).toBe(DEFAULT_BLIND_LABELS);
	});

	it("preserves a matched variant's null blind labels rather than falling back to defaults", () => {
		const variants = [
			variant({
				name: "Stud",
				blindLabel1: "Bring-in",
				blindLabel2: null,
				blindLabel3: null,
			}),
		];
		expect(resolveBlindLabels("Stud", variants)).toEqual({
			blind1: "Bring-in",
			blind2: null,
			blind3: null,
		});
	});

	it("DEFAULT_BLIND_LABELS is SB/BB/Straddle", () => {
		expect(DEFAULT_BLIND_LABELS).toEqual({
			blind1: "SB",
			blind2: "BB",
			blind3: "Straddle",
		});
	});
});
