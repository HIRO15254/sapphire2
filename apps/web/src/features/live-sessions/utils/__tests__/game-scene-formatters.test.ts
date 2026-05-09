import { describe, expect, it } from "vitest";
import {
	formatAnteSuffix,
	formatBlindParts,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import type {
	RingGame,
	RingGameBlindSet,
} from "@/features/stores/hooks/use-ring-games";

function makeBlindSet(
	overrides: Partial<RingGameBlindSet> = {}
): RingGameBlindSet {
	return {
		id: 1,
		ringGameId: "rg-1",
		limitFormatId: 1,
		blind1: 0,
		blind2: 0,
		blind3: null,
		blind4: null,
		ante: null,
		anteType: "none",
		sortOrder: 0,
		...overrides,
	};
}

function ringGame(overrides: Partial<RingGame> = {}): RingGame {
	return {
		id: "rg-1",
		storeId: "store-1",
		name: "Test",
		currencyId: "currency-1",
		variantId: null,
		blindSets: [],
		tableSize: 9,
		minBuyIn: null,
		maxBuyIn: null,
		memo: null,
		archivedAt: null,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		...overrides,
	};
}

describe("variantLabel", () => {
	it("maps 'nlh' to 'NLH'", () => {
		expect(variantLabel("nlh")).toBe("NLH");
	});

	it("uppercases unknown variants", () => {
		expect(variantLabel("plo")).toBe("PLO");
		expect(variantLabel("mixed")).toBe("MIXED");
	});

	it("returns empty string for empty string", () => {
		expect(variantLabel("")).toBe("");
	});

	it("returns empty string for null", () => {
		expect(variantLabel(null)).toBe("");
	});

	it("returns empty string for undefined", () => {
		expect(variantLabel(undefined)).toBe("");
	});
});

describe("formatBlindParts", () => {
	it("returns empty string when blindSets is empty", () => {
		expect(formatBlindParts(ringGame())).toBe("");
	});

	it("returns empty string when blindSets[0] is missing", () => {
		expect(formatBlindParts(ringGame({ blindSets: [] }))).toBe("");
	});

	it("formats blind1/blind2 from blindSets[0]", () => {
		expect(
			formatBlindParts(
				ringGame({
					blindSets: [makeBlindSet({ blind1: 100, blind2: 200 })],
				})
			)
		).toBe("100/200");
	});

	it("formats blind1/blind2/blind3 from blindSets[0]", () => {
		expect(
			formatBlindParts(
				ringGame({
					blindSets: [makeBlindSet({ blind1: 100, blind2: 200, blind3: 300 })],
				})
			)
		).toBe("100/200/300");
	});

	it("uses group formatter across all blinds (compact notation)", () => {
		expect(
			formatBlindParts(
				ringGame({
					blindSets: [
						makeBlindSet({ blind1: 100, blind2: 200, blind3: 10_000 }),
					],
				})
			)
		).toBe("0.1k/0.2k/10k");
	});

	it("treats 0 as a valid blind2 value", () => {
		expect(
			formatBlindParts(
				ringGame({
					blindSets: [makeBlindSet({ blind1: 100, blind2: 0 })],
				})
			)
		).toBe("100/0");
	});

	it("omits blind3 when null", () => {
		expect(
			formatBlindParts(
				ringGame({
					blindSets: [makeBlindSet({ blind1: 1, blind2: 2, blind3: null })],
				})
			)
		).toBe("1/2");
	});
});

describe("formatAnteSuffix", () => {
	it("returns empty when anteType is 'none'", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 100, anteType: "none" })],
				})
			)
		).toBe("");
	});

	it("returns empty when ante is null", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: null, anteType: "bb" })],
				})
			)
		).toBe("");
	});

	it("returns empty when anteType is null", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 100, anteType: null })],
				})
			)
		).toBe("");
	});

	it("returns empty when blindSets is empty", () => {
		expect(formatAnteSuffix(ringGame({ blindSets: [] }))).toBe("");
	});

	it("returns (BBA:x) for bb ante", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 100, anteType: "bb" })],
				})
			)
		).toBe("(BBA:100)");
	});

	it("returns (Ante:x) for all ante", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 25, anteType: "all" })],
				})
			)
		).toBe("(Ante:25)");
	});

	it("returns empty for unknown anteType", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 100, anteType: "unknown" })],
				})
			)
		).toBe("");
	});

	it("compacts large ante values", () => {
		expect(
			formatAnteSuffix(
				ringGame({
					blindSets: [makeBlindSet({ ante: 15_000, anteType: "all" })],
				})
			)
		).toBe("(Ante:15k)");
	});
});
