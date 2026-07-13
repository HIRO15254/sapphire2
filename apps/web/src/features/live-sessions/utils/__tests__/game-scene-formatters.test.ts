import { describe, expect, it } from "vitest";
import {
	formatAnteSuffix,
	formatBlindParts,
	formatGroupStakes,
	formatMixSummary,
	type GameGroupLike,
	groupDisplayLabel,
	variantLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import type { RingGame } from "@/features/rooms/hooks/use-ring-games";

function ringGame(overrides: Partial<RingGame> = {}): RingGame {
	return {
		id: "rg-1",
		roomId: "room-1",
		name: "Test",
		currencyId: "currency-1",
		variant: "NL Hold'em",
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		anteType: "none",
		tableSize: 9,
		...overrides,
	} as RingGame;
}

function group(overrides: Partial<GameGroupLike> = {}): GameGroupLike {
	return {
		variants: ["NL Hold'em"],
		...overrides,
	};
}

describe("variantLabel", () => {
	it("maps 'mix' to 'Mixed Game'", () => {
		expect(variantLabel("mix")).toBe("Mixed Game");
	});

	it("passes through a stored variant label unchanged", () => {
		expect(variantLabel("NL Hold'em")).toBe("NL Hold'em");
	});

	it("passes through a legacy preset key unchanged (no mapping table anymore)", () => {
		expect(variantLabel("nlh")).toBe("nlh");
	});

	it("passes through a custom variant's display label unchanged (no uppercasing)", () => {
		expect(variantLabel("Custom Game")).toBe("Custom Game");
	});

	it("passes through an empty string unchanged", () => {
		expect(variantLabel("")).toBe("");
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

	it("renders blind2 alone without a leading slash", () => {
		expect(formatBlindParts(ringGame({ blind2: 200 }))).toBe("200");
	});

	it("renders blind3 alone without a leading slash", () => {
		expect(formatBlindParts(ringGame({ blind3: 100 }))).toBe("100");
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

describe("groupDisplayLabel", () => {
	it("uses the group's name when present", () => {
		expect(
			groupDisplayLabel(
				group({ name: "Round 1", variants: ["NL Hold'em", "Pot Limit Omaha"] })
			)
		).toBe("Round 1");
	});

	it("falls back to raw variant labels when name is whitespace-only", () => {
		expect(
			groupDisplayLabel(
				group({ name: "   ", variants: ["NL Hold'em", "Pot Limit Omaha"] })
			)
		).toBe("NL Hold'em+Pot Limit Omaha");
	});

	it("joins raw variant labels with '+' when no name is set", () => {
		expect(
			groupDisplayLabel(
				group({
					variants: ["NL Hold'em", "Pot Limit Omaha", "Seven Card Stud"],
				})
			)
		).toBe("NL Hold'em+Pot Limit Omaha+Seven Card Stud");
	});

	it("returns '—' when variants is empty and no name is set", () => {
		expect(groupDisplayLabel(group({ variants: [] }))).toBe("—");
	});
});

describe("formatGroupStakes", () => {
	it("formats blind1/blind2 with no blind3 slot", () => {
		expect(
			formatGroupStakes(
				group({ variants: ["Limit Hold'em"], blind1: 1, blind2: 2 })
			)
		).toBe("1/2");
	});

	it("appends blind3 with a slash", () => {
		expect(
			formatGroupStakes(
				group({ variants: ["NL Hold'em"], blind1: 1, blind2: 2, blind3: 5 })
			)
		).toBe("1/2/5");
	});

	it("appends blind3 with a slash even for a stud-family variant (no more label-driven bring-in suffix)", () => {
		expect(
			formatGroupStakes(
				group({
					variants: ["Seven Card Stud"],
					blind1: 400,
					blind2: 800,
					blind3: 100,
					ante: 75,
				})
			)
		).toBe("400/800/100 (Ante:75)");
	});

	it("uses the BBA suffix convention when anteType is 'bb'", () => {
		expect(
			formatGroupStakes(
				group({
					variants: ["NL Hold'em"],
					blind1: 1,
					blind2: 2,
					ante: 1,
					anteType: "bb",
				})
			)
		).toBe("1/2 (BBA:1)");
	});

	it("uses the Ante suffix convention when anteType is 'all'", () => {
		expect(
			formatGroupStakes(
				group({
					variants: ["NL Hold'em"],
					blind1: 1,
					blind2: 2,
					ante: 3,
					anteType: "all",
				})
			)
		).toBe("1/2 (Ante:3)");
	});

	it("inserts a '—' placeholder when blind1 is present but blind2 is null", () => {
		expect(
			formatGroupStakes(group({ variants: ["NL Hold'em"], blind1: 100 }))
		).toBe("100/—");
	});

	it("returns '—' when every numeric field is null", () => {
		expect(formatGroupStakes(group({ variants: ["NL Hold'em"] }))).toBe("—");
	});

	it("applies compact notation across the group's numeric fields", () => {
		expect(
			formatGroupStakes(
				group({ variants: ["NL Hold'em"], blind1: 10_000, blind2: 20_000 })
			)
		).toBe("10k/20k");
	});

	it("omits the ante suffix when anteType is 'none' despite a stale ante value", () => {
		expect(
			formatGroupStakes(
				group({
					variants: ["NL Hold'em"],
					blind1: 1,
					blind2: 2,
					ante: 75,
					anteType: "none",
				})
			)
		).toBe("1/2");
	});

	it("excludes a hidden large ante from the visible blinds' compact tier", () => {
		expect(
			formatGroupStakes(
				group({
					variants: ["NL Hold'em"],
					blind1: 1,
					blind2: 2,
					ante: 10_000,
					anteType: "none",
				})
			)
		).toBe("1/2");
	});

	it("renders a blind2-only group without a leading slash", () => {
		expect(
			formatGroupStakes(group({ variants: ["NL Hold'em"], blind2: 2 }))
		).toBe("2");
	});

	it("renders a blind3-only group without a leading slash", () => {
		expect(
			formatGroupStakes(group({ variants: ["NL Hold'em"], blind3: 100 }))
		).toBe("100");
	});

	it("renders an ante-only 'none' group as '—'", () => {
		expect(
			formatGroupStakes(
				group({ variants: ["NL Hold'em"], ante: 75, anteType: "none" })
			)
		).toBe("—");
	});

	it("renders an ante-only group with a paying anteType as just the suffix", () => {
		expect(
			formatGroupStakes(
				group({ variants: ["NL Hold'em"], ante: 75, anteType: "all" })
			)
		).toBe("(Ante:75)");
	});
});

describe("formatMixSummary", () => {
	it("returns 'Mix' for an empty groups array", () => {
		expect(formatMixSummary([])).toBe("Mix");
	});

	it("renders a single group with its label and stakes", () => {
		expect(
			formatMixSummary([
				group({ variants: ["NL Hold'em"], blind1: 1, blind2: 2 }),
			])
		).toBe("Mix · NL Hold'em 1/2");
	});

	it("truncates beyond maxGroups and appends a (+k) suffix", () => {
		const groups = [
			group({ variants: ["NL Hold'em"], blind1: 1, blind2: 2 }),
			group({ variants: ["Pot Limit Omaha"], blind1: 2, blind2: 4 }),
			group({ variants: ["Seven Card Stud"], blind1: 400, blind2: 800 }),
		];
		expect(formatMixSummary(groups)).toBe(
			"Mix · NL Hold'em 1/2 · Pot Limit Omaha 2/4 (+1)"
		);
	});

	it("respects a custom maxGroups", () => {
		const groups = [
			group({ variants: ["NL Hold'em"], blind1: 1, blind2: 2 }),
			group({ variants: ["Pot Limit Omaha"], blind1: 2, blind2: 4 }),
			group({ variants: ["Seven Card Stud"], blind1: 400, blind2: 800 }),
		];
		expect(formatMixSummary(groups, 1)).toBe("Mix · NL Hold'em 1/2 (+2)");
	});

	it("omits the stakes segment when formatGroupStakes returns '—'", () => {
		expect(formatMixSummary([group({ variants: ["NL Hold'em"] })])).toBe(
			"Mix · NL Hold'em"
		);
	});

	it("does not append a (+k) suffix when nothing was truncated", () => {
		const groups = [
			group({ variants: ["NL Hold'em"], blind1: 1, blind2: 2 }),
			group({ variants: ["Pot Limit Omaha"], blind1: 2, blind2: 4 }),
		];
		expect(formatMixSummary(groups)).toBe(
			"Mix · NL Hold'em 1/2 · Pot Limit Omaha 2/4"
		);
	});
});
