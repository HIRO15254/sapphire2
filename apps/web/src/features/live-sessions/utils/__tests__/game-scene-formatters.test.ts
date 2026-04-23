import { describe, expect, it } from "vitest";
import {
	formatAnteSuffix,
	formatBlindParts,
	VARIANT_LABELS,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import type { RingGame } from "@/features/stores/hooks/use-ring-games";

function ringGame(overrides: Partial<RingGame> = {}): RingGame {
	return {
		id: "rg-1",
		storeId: "store-1",
		name: "Test",
		currencyId: "currency-1",
		variant: "nlh",
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		anteType: "none",
		tableSize: 9,
		...overrides,
	} as RingGame;
}

describe("variantLabel", () => {
	it("maps 'nlh' to 'NLH'", () => {
		expect(variantLabel("nlh")).toBe("NLH");
	});

	it("uppercases unknown variants", () => {
		expect(variantLabel("plo")).toBe("PLO");
		expect(variantLabel("mixed")).toBe("MIXED");
	});

	it("returns empty uppercase for empty string", () => {
		expect(variantLabel("")).toBe("");
	});

	it("VARIANT_LABELS exposes known mappings", () => {
		expect(VARIANT_LABELS.nlh).toBe("NLH");
	});
});

describe("formatBlindParts", () => {
	it("returns empty string when no blinds are set", () => {
		expect(formatBlindParts(ringGame())).toBe("");
	});

	it("formats blind1 only with trailing '—' placeholder (parts.length > 0 branch)", () => {
		// Code appends '—' for a missing blind2 whenever blind1 was pushed,
		// regardless of whether blind3 follows.
		expect(formatBlindParts(ringGame({ blind1: 100 }))).toBe("100/—");
	});

	it("formats blind1/blind2", () => {
		expect(formatBlindParts(ringGame({ blind1: 100, blind2: 200 }))).toBe(
			"100/200"
		);
	});

	it("inserts '—' when blind2 is missing but blind1 is present", () => {
		// With blind1 only and blind3 set, blind2 should be '—'.
		expect(formatBlindParts(ringGame({ blind1: 100, blind3: 300 }))).toBe(
			"100/—/300"
		);
	});

	it("uses group formatter across all blinds (compact notation)", () => {
		expect(
			formatBlindParts(ringGame({ blind1: 100, blind2: 200, blind3: 10_000 }))
		).toBe("0.1k/0.2k/10k");
	});

	it("treats 0 as a valid blind value", () => {
		// blind2 = 0 is !== null, so it should be included.
		expect(formatBlindParts(ringGame({ blind1: 100, blind2: 0 }))).toBe(
			"100/0"
		);
	});
});

describe("formatAnteSuffix", () => {
	it("returns empty when anteType is 'none'", () => {
		expect(formatAnteSuffix(ringGame({ ante: 100, anteType: "none" }))).toBe(
			""
		);
	});

	it("returns empty when ante is null", () => {
		expect(formatAnteSuffix(ringGame({ ante: null, anteType: "bb" }))).toBe("");
	});

	it("returns empty when anteType is null", () => {
		expect(
			formatAnteSuffix(
				ringGame({ ante: 100, anteType: null as unknown as string })
			)
		).toBe("");
	});

	it("returns (BBA:x) for bb ante", () => {
		expect(formatAnteSuffix(ringGame({ ante: 100, anteType: "bb" }))).toBe(
			"(BBA:100)"
		);
	});

	it("returns (Ante:x) for all ante", () => {
		expect(formatAnteSuffix(ringGame({ ante: 25, anteType: "all" }))).toBe(
			"(Ante:25)"
		);
	});

	it("returns empty for unknown anteType", () => {
		expect(formatAnteSuffix(ringGame({ ante: 100, anteType: "unknown" }))).toBe(
			""
		);
	});

	it("compacts large ante values", () => {
		expect(formatAnteSuffix(ringGame({ ante: 15_000, anteType: "all" }))).toBe(
			"(Ante:15k)"
		);
	});
});
