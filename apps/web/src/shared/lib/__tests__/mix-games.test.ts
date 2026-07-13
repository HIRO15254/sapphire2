import { describe, expect, it } from "vitest";
import {
	addVariant,
	fromLevelGames,
	fromMixGames,
	type MixGameGroupRow,
	type MixGroupInfo,
	PENDING_GROUP_ID,
	type ResolveGroup,
	removeGroup,
	removeVariant,
	reseedFromLabels,
	rowsFromVariantLabels,
	toLevelGames,
	toMixGames,
	updateGroup,
	usedVariants,
} from "../mix-games";

// Master fixture: three seeded groups + one user-defined "Draw" group.
const GROUPS: Record<string, MixGroupInfo> = {
	limit: {
		id: "g-limit",
		label: "Limit",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
		sortIndex: 0,
	},
	stud: {
		id: "g-stud",
		label: "Stud",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: "Bring-in",
		sortIndex: 1,
	},
	bigbet: {
		id: "g-bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
		sortIndex: 2,
	},
	draw: {
		id: "g-draw",
		label: "Draw",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
		sortIndex: 3,
	},
};

// variant label → owning group (unknown labels park in Big Bet).
const VARIANT_GROUPS: Record<string, MixGroupInfo> = {
	"NL Hold'em": GROUPS.bigbet,
	"Pot Limit Omaha": GROUPS.bigbet,
	"Limit Hold'em": GROUPS.limit,
	"Limit Omaha Hi-Lo": GROUPS.limit,
	"Limit 2-7 Triple Draw": GROUPS.limit,
	Badugi: GROUPS.limit,
	"NL 2-7 Single Draw": GROUPS.bigbet,
	Razz: GROUPS.stud,
	"Seven Card Stud": GROUPS.stud,
	"Stud Hi-Lo": GROUPS.stud,
	Drawmaha: GROUPS.draw,
};

const resolveGroup: ResolveGroup = (variant) =>
	VARIANT_GROUPS[variant] ?? GROUPS.bigbet;

// Mirrors use-game-groups' masters-empty fallback: unresolved labels get the
// pending sentinel group instead of a real group row.
const PENDING_GROUP: MixGroupInfo = {
	id: PENDING_GROUP_ID,
	label: "Big Bet",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 99,
};

const resolveWithPending: ResolveGroup = (variant) =>
	VARIANT_GROUPS[variant] ?? PENDING_GROUP;

function bucketSummary(rows: MixGameGroupRow[]): [string, string[]][] {
	return rows.map((r) => [r.groupLabel, r.variants]);
}

describe("addVariant", () => {
	it("creates a bucket for the variant's group on first add", () => {
		const rows = addVariant([], "Limit Hold'em", resolveGroup);
		expect(rows).toHaveLength(1);
		expect(rows[0].groupId).toBe("g-limit");
		expect(rows[0].groupLabel).toBe("Limit");
		expect(rows[0].name).toBeNull();
		expect(rows[0].variants).toEqual(["Limit Hold'em"]);
		expect(rows[0].blind1).toBe("");
		expect(rows[0].anteType).toBe("none");
	});

	it("appends to the existing bucket of the same group", () => {
		let rows = addVariant([], "Limit Hold'em", resolveGroup);
		rows = addVariant(rows, "Limit Omaha Hi-Lo", resolveGroup);
		expect(rows).toHaveLength(1);
		expect(rows[0].variants).toEqual(["Limit Hold'em", "Limit Omaha Hi-Lo"]);
	});

	it("keeps buckets in canonical group order regardless of add order", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup); // bigbet (2)
		rows = addVariant(rows, "Razz", resolveGroup); // stud (1)
		rows = addVariant(rows, "Limit Hold'em", resolveGroup); // limit (0)
		rows = addVariant(rows, "Drawmaha", resolveGroup); // draw (3)
		expect(rows.map((r) => r.groupLabel)).toEqual([
			"Limit",
			"Stud",
			"Big Bet",
			"Draw",
		]);
	});

	it("is a no-op for a variant already present in any bucket (case-insensitive)", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = addVariant(rows, "nl hold'em", resolveGroup);
		expect(rows).toHaveLength(1);
		expect(rows[0].variants).toEqual(["NL Hold'em"]);
	});

	it("does not disturb amounts already entered on an existing bucket", () => {
		let rows = addVariant([], "Limit Hold'em", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, { blind1: "400", blind2: "800" });
		rows = addVariant(rows, "Badugi", resolveGroup);
		expect(rows[0].blind1).toBe("400");
		expect(rows[0].variants).toContain("Badugi");
	});
});

describe("removeVariant", () => {
	it("removes the variant from its bucket", () => {
		let rows = addVariant([], "Limit Hold'em", resolveGroup);
		rows = addVariant(rows, "Badugi", resolveGroup);
		rows = removeVariant(rows, "Limit Hold'em");
		expect(rows).toHaveLength(1);
		expect(rows[0].variants).toEqual(["Badugi"]);
	});

	it("drops the bucket when its last variant is removed", () => {
		let rows = addVariant([], "Razz", resolveGroup);
		rows = addVariant(rows, "NL Hold'em", resolveGroup);
		rows = removeVariant(rows, "Razz");
		expect(bucketSummary(rows)).toEqual([["Big Bet", ["NL Hold'em"]]]);
	});

	it("is a no-op for an unknown variant", () => {
		const rows = addVariant([], "Razz", resolveGroup);
		expect(removeVariant(rows, "Badugi")).toEqual(rows);
	});
});

describe("removeGroup", () => {
	it("removes the whole bucket with all its games", () => {
		let rows = addVariant([], "Razz", resolveGroup);
		rows = addVariant(rows, "Seven Card Stud", resolveGroup);
		rows = addVariant(rows, "NL Hold'em", resolveGroup);
		const next = removeGroup(rows, rows[0].uid);
		expect(bucketSummary(next)).toEqual([["Big Bet", ["NL Hold'em"]]]);
	});

	it("is a no-op for an unknown uid", () => {
		const rows = addVariant([], "Razz", resolveGroup);
		expect(removeGroup(rows, "missing-uid")).toEqual(rows);
	});

	it("returns empty when the last bucket is removed", () => {
		const rows = addVariant([], "Razz", resolveGroup);
		expect(removeGroup(rows, rows[0].uid)).toEqual([]);
	});
});

describe("updateGroup / usedVariants", () => {
	it("patches only the matching bucket", () => {
		let rows = addVariant([], "Razz", resolveGroup);
		rows = addVariant(rows, "NL Hold'em", resolveGroup);
		const next = updateGroup(rows, rows[1].uid, { name: "NL/PL", ante: "5" });
		expect(next[0].name).toBeNull();
		expect(next[1].name).toBe("NL/PL");
		expect(next[1].ante).toBe("5");
	});

	it("usedVariants flattens all buckets in display order", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = addVariant(rows, "Razz", resolveGroup);
		expect(usedVariants(rows)).toEqual(["Razz", "NL Hold'em"]);
	});
});

describe("toMixGames / fromMixGames", () => {
	it("serializes buckets to the shared payload shape (no materialized name)", () => {
		let rows = addVariant([], "Razz", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, {
			blind1: "400",
			blind2: "800",
			blind3: "100",
			ante: "75",
			anteType: "all",
		});
		expect(toMixGames(rows)).toEqual([
			{
				name: null,
				variants: ["Razz"],
				blind1: 400,
				blind2: 800,
				blind3: 100,
				ante: 75,
				anteType: "all",
			},
		]);
	});

	it("serializes a user-entered name trimmed", () => {
		let rows = addVariant([], "Razz", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, { name: "  My Studs  " });
		expect(toMixGames(rows)?.[0].name).toBe("My Studs");
	});

	it("emits ante: null when anteType is 'none' even if the cell holds a stale value", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, {
			blind1: "1",
			blind2: "2",
			ante: "75",
			anteType: "none",
		});
		const games = toMixGames(rows);
		expect(games?.[0].ante).toBeNull();
		expect(games?.[0].anteType).toBe("none");
	});

	it("maps blank/invalid cells to null and blank names to null", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, { name: "  ", blind1: "abc" });
		const games = toMixGames(rows);
		expect(games?.[0].name).toBeNull();
		expect(games?.[0].blind1).toBeNull();
	});

	it("returns null for an empty editor", () => {
		expect(toMixGames([])).toBeNull();
	});

	it("round-trips stored games back to buckets, re-deriving the group", () => {
		const rows = fromMixGames(
			[
				{
					name: "My Studs",
					variants: ["Razz", "Seven Card Stud"],
					blind1: 400,
					blind2: 800,
					blind3: 100,
					ante: 75,
					anteType: null,
				},
			],
			resolveGroup
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].groupId).toBe("g-stud");
		expect(rows[0].groupLabel).toBe("Stud");
		expect(rows[0].name).toBe("My Studs");
		expect(rows[0].blind1).toBe("400");
		expect(rows[0].anteType).toBe("none");
	});

	it("keeps a stored null name null (display falls back at render time)", () => {
		const rows = fromMixGames(
			[{ name: null, variants: ["NL Hold'em"] }],
			resolveGroup
		);
		expect(rows[0].name).toBeNull();
		expect(rows[0].groupLabel).toBe("Big Bet");
	});

	it("round-trips a null-name group value-identically (no frozen display label)", () => {
		const input = [
			{
				name: null,
				variants: ["NL Hold'em"],
				blind1: 1,
				blind2: 2,
				blind3: null,
				ante: null,
				anteType: "none" as const,
			},
		];
		expect(toMixGames(fromMixGames(input, resolveGroup))).toEqual(input);
	});

	it("returns an empty array for null/undefined stored games", () => {
		expect(fromMixGames(null, resolveGroup)).toEqual([]);
		expect(fromMixGames(undefined, resolveGroup)).toEqual([]);
	});
});

describe("fromMixGames — unresolved stored groups keep distinct buckets", () => {
	it("derives per-bucket pending groupIds for unresolved first variants", () => {
		const rows = fromMixGames(
			[
				{ name: null, variants: ["Ghost A"], blind1: 400, blind2: 800 },
				{ name: null, variants: ["Ghost B"], blind1: 100, blind2: 200 },
			],
			resolveWithPending
		);
		expect(rows[0].groupId).toBe(`${PENDING_GROUP_ID}:Ghost A`);
		expect(rows[1].groupId).toBe(`${PENDING_GROUP_ID}:Ghost B`);
		expect(rows[0].groupId).not.toBe(rows[1].groupId);
	});

	it("derives a distinct id when a later group collapses into an already-used group id", () => {
		const rows = fromMixGames(
			[
				{ name: null, variants: ["NL Hold'em"], blind1: 1, blind2: 2 },
				{ name: null, variants: ["Ghost"], blind1: 400, blind2: 800 },
			],
			resolveGroup // parks unknowns in the real Big Bet group
		);
		expect(rows[0].groupId).toBe("g-bigbet");
		expect(rows[1].groupId).toBe(`${PENDING_GROUP_ID}:Ghost`);
	});

	it("joins all variants into the derived id for a multi-variant unresolved group", () => {
		const rows = fromMixGames(
			[{ name: null, variants: ["Ghost A", "Ghost B"] }],
			resolveWithPending
		);
		expect(rows[0].groupId).toBe(`${PENDING_GROUP_ID}:Ghost A+Ghost B`);
	});

	it("preserves both buckets' amounts through a reseedFromLabels round-trip", () => {
		const rows = fromMixGames(
			[
				{ name: null, variants: ["Ghost A"], blind1: 400, blind2: 800 },
				{ name: null, variants: ["Ghost B"], blind1: 100, blind2: 200 },
			],
			resolveWithPending
		);
		const next = reseedFromLabels(
			rows,
			["Ghost A", "Ghost B"],
			resolveWithPending
		);
		expect(next).toHaveLength(2);
		expect(next[0].variants).toEqual(["Ghost A"]);
		expect(next[0].blind1).toBe("400");
		expect(next[0].blind2).toBe("800");
		expect(next[1].variants).toEqual(["Ghost B"]);
		expect(next[1].blind1).toBe("100");
		expect(next[1].blind2).toBe("200");
	});
});

describe("addVariant — pending (unresolved) groups", () => {
	it("gives each unresolved variant its own pending bucket", () => {
		let rows = addVariant([], "Ghost A", resolveWithPending);
		rows = addVariant(rows, "Ghost B", resolveWithPending);
		expect(rows).toHaveLength(2);
		expect(rows[0].groupId).toBe(`${PENDING_GROUP_ID}:Ghost A`);
		expect(rows[1].groupId).toBe(`${PENDING_GROUP_ID}:Ghost B`);
	});

	it("still merges resolvable variants of one group into one bucket", () => {
		let rows = addVariant([], "Razz", resolveWithPending);
		rows = addVariant(rows, "Seven Card Stud", resolveWithPending);
		expect(rows).toHaveLength(1);
		expect(rows[0].groupId).toBe("g-stud");
	});
});

describe("toLevelGames / fromLevelGames", () => {
	it("strips anteType for level payloads and round-trips", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, { blind1: "100", blind2: "200" });
		const games = toLevelGames(rows);
		expect(games).toEqual([
			{
				name: null,
				variants: ["NL Hold'em"],
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: null,
			},
		]);
		const back = fromLevelGames(games, resolveGroup);
		expect(back[0].groupId).toBe("g-bigbet");
		expect(back[0].anteType).toBe("none");
	});

	it("keeps the ante for level payloads despite the row's 'none' anteType default", () => {
		let rows = addVariant([], "NL Hold'em", resolveGroup);
		rows = updateGroup(rows, rows[0].uid, {
			blind1: "100",
			blind2: "200",
			ante: "75",
		});
		// Level mode never shows the anteType select, so rows keep the "none"
		// default — the level payload must not drop the ante because of it.
		expect(rows[0].anteType).toBe("none");
		expect(toLevelGames(rows)?.[0].ante).toBe(75);
	});
});

describe("rowsFromVariantLabels", () => {
	it("builds buckets from an ordered composition", () => {
		const rows = rowsFromVariantLabels(
			[
				"Limit Hold'em",
				"Limit Omaha Hi-Lo",
				"Razz",
				"Seven Card Stud",
				"Stud Hi-Lo",
			],
			resolveGroup
		);
		expect(bucketSummary(rows)).toEqual([
			["Limit", ["Limit Hold'em", "Limit Omaha Hi-Lo"]],
			["Stud", ["Razz", "Seven Card Stud", "Stud Hi-Lo"]],
		]);
	});

	it("keeps canonical bucket order for a full 8-game style composition", () => {
		const rows = rowsFromVariantLabels(
			[
				"Limit 2-7 Triple Draw",
				"Limit Hold'em",
				"Razz",
				"NL Hold'em",
				"Pot Limit Omaha",
			],
			resolveGroup
		);
		expect(rows.map((r) => r.groupLabel)).toEqual(["Limit", "Stud", "Big Bet"]);
		expect(rows[2].variants).toEqual(["NL Hold'em", "Pot Limit Omaha"]);
	});

	it("skips duplicate labels and returns empty for an empty composition", () => {
		expect(rowsFromVariantLabels([], resolveGroup)).toEqual([]);
		const rows = rowsFromVariantLabels(["Razz", "razz"], resolveGroup);
		expect(rows[0].variants).toEqual(["Razz"]);
	});
});

describe("reseedFromLabels", () => {
	function seededRows() {
		let rows = rowsFromVariantLabels(
			["Limit Hold'em", "Razz", "NL Hold'em"],
			resolveGroup
		);
		rows = updateGroup(rows, rows[0].uid, {
			name: "Limit games",
			blind1: "400",
			blind2: "800",
		});
		rows = updateGroup(rows, rows[2].uid, { blind1: "100", blind2: "200" });
		return rows;
	}

	it("keeps entered amounts and names for groups that survive the new composition", () => {
		const rows = seededRows();
		const next = reseedFromLabels(
			rows,
			["Limit Hold'em", "Badugi", "NL Hold'em", "Pot Limit Omaha"],
			resolveGroup
		);
		expect(bucketSummary(next)).toEqual([
			["Limit", ["Limit Hold'em", "Badugi"]],
			["Big Bet", ["NL Hold'em", "Pot Limit Omaha"]],
		]);
		expect(next[0].name).toBe("Limit games");
		expect(next[0].blind1).toBe("400");
		expect(next[0].blind2).toBe("800");
		expect(next[1].blind1).toBe("100");
	});

	it("drops groups removed from the composition and seeds new groups blank", () => {
		const rows = seededRows();
		const next = reseedFromLabels(rows, ["Drawmaha"], resolveGroup);
		expect(bucketSummary(next)).toEqual([["Draw", ["Drawmaha"]]]);
		expect(next[0].blind1).toBe("");
		expect(next[0].name).toBeNull();
	});

	it("returns empty for an empty composition", () => {
		expect(reseedFromLabels(seededRows(), [], resolveGroup)).toEqual([]);
	});
});
