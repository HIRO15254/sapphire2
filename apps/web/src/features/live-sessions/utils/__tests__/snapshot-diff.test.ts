import { describe, expect, it } from "vitest";
import {
	diffBlindLevels,
	diffCashSnapshot,
} from "@/features/live-sessions/utils/snapshot-diff";

function cashSnapshot(overrides: Record<string, unknown> = {}) {
	return {
		ruleName: "1/2 NLH",
		variant: "NL Hold'em",
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		minBuyIn: 100,
		maxBuyIn: 300,
		tableSize: 9,
		mixGames: null,
		...overrides,
	};
}

function cashMaster(overrides: Record<string, unknown> = {}) {
	return {
		name: "1/2 NLH",
		variant: "NL Hold'em",
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		minBuyIn: 100,
		maxBuyIn: 300,
		tableSize: 9,
		mixGames: null,
		...overrides,
	};
}

function gameGroup(overrides: Record<string, unknown> = {}) {
	return {
		name: null,
		variants: ["NL Hold'em"],
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		...overrides,
	};
}

function cashSnapshotDiff(
	snapOverrides: Record<string, unknown> = {},
	masterOverrides: Record<string, unknown> = {}
) {
	return diffCashSnapshot(
		cashSnapshot(snapOverrides),
		cashMaster(masterOverrides)
	);
}

describe("diffCashSnapshot — mixGames", () => {
	it("reports no mixGames diff when both sides are null", () => {
		expect(cashSnapshotDiff().mixGames).toBe(false);
	});

	it("reports no diff for structurally identical mixGames", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup(), gameGroup({ variants: ["Razz"], name: "S" })] },
			{ mixGames: [gameGroup(), gameGroup({ variants: ["Razz"], name: "S" })] }
		);
		expect(diff.mixGames).toBe(false);
	});

	it("detects a mixGames-only divergence without touching other fields", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup({ blind1: 5 })] },
			{ mixGames: [gameGroup()] }
		);
		expect(diff.mixGames).toBe(true);
		expect(diff.blind1).toBe(false);
		expect(diff.variant).toBe(false);
		expect(diff.ruleName).toBe(false);
	});

	it("detects snapshot mixGames present while master has none", () => {
		const diff = cashSnapshotDiff({ mixGames: [gameGroup()] }, {});
		expect(diff.mixGames).toBe(true);
	});

	it("detects master mixGames present while snapshot has none", () => {
		const diff = cashSnapshotDiff({}, { mixGames: [gameGroup()] });
		expect(diff.mixGames).toBe(true);
	});

	it("detects a length divergence", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup()] },
			{ mixGames: [gameGroup(), gameGroup({ variants: ["Razz"] })] }
		);
		expect(diff.mixGames).toBe(true);
	});

	it("is order-sensitive on group position", () => {
		const a = gameGroup();
		const b = gameGroup({ variants: ["Razz"] });
		const diff = cashSnapshotDiff({ mixGames: [a, b] }, { mixGames: [b, a] });
		expect(diff.mixGames).toBe(true);
	});

	it("is order-sensitive on a group's variants", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup({ variants: ["A", "B"] })] },
			{ mixGames: [gameGroup({ variants: ["B", "A"] })] }
		);
		expect(diff.mixGames).toBe(true);
	});

	it("detects a name divergence", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup({ name: "Round 1" })] },
			{ mixGames: [gameGroup({ name: null })] }
		);
		expect(diff.mixGames).toBe(true);
	});

	it("detects a per-group anteType-only divergence", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup({ ante: 1, anteType: "all" })] },
			{ mixGames: [gameGroup({ ante: 1, anteType: "bb" })] }
		);
		expect(diff.mixGames).toBe(true);
	});

	it("treats an absent group anteType and null as equal", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [gameGroup()] },
			{ mixGames: [gameGroup({ anteType: null })] }
		);
		expect(diff.mixGames).toBe(false);
	});

	it("treats an absent field and a null field as equal", () => {
		const diff = cashSnapshotDiff(
			{ mixGames: [{ variants: ["NL Hold'em"], blind1: 1, blind2: 2 }] },
			{
				mixGames: [
					{
						name: null,
						variants: ["NL Hold'em"],
						blind1: 1,
						blind2: 2,
						blind3: null,
						ante: null,
					},
				],
			}
		);
		expect(diff.mixGames).toBe(false);
	});

	it("returns an empty diff when the master is missing", () => {
		expect(
			diffCashSnapshot(cashSnapshot({ mixGames: [gameGroup()] }), null)
		).toEqual({});
	});
});

function level(overrides: Record<string, unknown> = {}) {
	return {
		isBreak: false,
		blind1: 100,
		blind2: 200,
		blind3: null,
		ante: null,
		minutes: 20,
		games: null,
		...overrides,
	};
}

describe("diffBlindLevels — games", () => {
	it("reports no diff for identical levels without games", () => {
		expect(diffBlindLevels([level()], [level()])).toBe(false);
	});

	it("reports no diff for identical levels with identical games", () => {
		expect(
			diffBlindLevels(
				[level({ games: [gameGroup()] })],
				[level({ games: [gameGroup()] })]
			)
		).toBe(false);
	});

	it("detects a games-only divergence", () => {
		expect(
			diffBlindLevels(
				[level({ games: [gameGroup({ blind1: 500 })] })],
				[level({ games: [gameGroup()] })]
			)
		).toBe(true);
	});

	it("detects games present on one side only", () => {
		expect(diffBlindLevels([level({ games: [gameGroup()] })], [level()])).toBe(
			true
		);
		expect(diffBlindLevels([level()], [level({ games: [gameGroup()] })])).toBe(
			true
		);
	});

	it("still detects flat blind divergences", () => {
		expect(diffBlindLevels([level({ blind1: 150 })], [level()])).toBe(true);
	});

	it("returns false when the master list is missing", () => {
		expect(diffBlindLevels([level({ games: [gameGroup()] })], null)).toBe(
			false
		);
	});
});
