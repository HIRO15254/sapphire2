import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { describe, expect, it } from "vitest";
import {
	type MixGameGroupRow,
	type MixGroupInfo,
	toMixGames,
} from "@/shared/lib/mix-games";
import {
	addEmptyGroup,
	describeMixStakesLine,
	describeMixValidity,
	filterVariantOptions,
	summarizeMix,
	toggleVariantInGroup,
	variantForComposition,
	withDerivedAnteTypes,
} from "../mix-composition";

const BIG_BET: MixGroupInfo = {
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	id: "g-bigbet",
	label: "Big Bet",
	sortIndex: 0,
};
const LIMIT: MixGroupInfo = {
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: null,
	id: "g-limit",
	label: "Limit",
	sortIndex: 1,
};
const STUD: MixGroupInfo = {
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: "Bring-in",
	id: "g-stud",
	label: "Stud",
	sortIndex: 2,
};

const FAMILY: Record<string, MixGroupInfo> = {
	"limit hold'em": LIMIT,
	"nl hold'em": BIG_BET,
	razz: STUD,
	stud: STUD,
};

const groupFor = (label: string): MixGroupInfo =>
	FAMILY[label.trim().toLowerCase()] ?? BIG_BET;

function twoEmptyGroups(): MixGameGroupRow[] {
	return addEmptyGroup(addEmptyGroup([], BIG_BET, "a"), BIG_BET, "b");
}

describe("toggleVariantInGroup", () => {
	it("takes the family and its blind labels from the first game added to an empty group", () => {
		const rows = toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor);
		expect(rows[0]).toMatchObject({
			blind1Label: "Small Bet",
			blind3Label: "Bring-in",
			groupLabel: "Stud",
			variants: ["Razz"],
		});
		const withSecond = toggleVariantInGroup(rows, "a", "NL Hold'em", groupFor);
		expect(withSecond[0]).toMatchObject({
			groupLabel: "Stud",
			variants: ["Razz", "NL Hold'em"],
		});
	});

	it("refuses a game another group already uses, whatever its casing", () => {
		const rows = toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor);
		expect(toggleVariantInGroup(rows, "b", " razz ", groupFor)).toEqual(rows);
	});

	it("removes an already picked game but keeps the now empty group and its family", () => {
		const rows = toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor);
		const cleared = toggleVariantInGroup(rows, "a", "Razz", groupFor);
		expect(cleared).toHaveLength(2);
		expect(cleared[0]).toMatchObject({ groupLabel: "Stud", variants: [] });
	});
});

describe("addEmptyGroup", () => {
	it("stops at the stored-schema cap on groups", () => {
		let rows: MixGameGroupRow[] = [];
		for (let i = 0; i < MAX_MIX_GROUPS + 2; i++) {
			rows = addEmptyGroup(rows, BIG_BET, `g${i}`);
		}
		expect(rows).toHaveLength(MAX_MIX_GROUPS);
	});
});

describe("describeMixValidity", () => {
	it("needs two games for a cash mix and one for a level composition", () => {
		const one = [{ variants: ["Razz"] }];
		const two = [{ variants: ["Razz"] }, { variants: ["NL Hold'em"] }];
		expect(describeMixValidity(one, "cash")).toEqual({
			isValid: false,
			label: "Needs 2+ games",
		});
		expect(describeMixValidity(two, "cash").isValid).toBe(true);
		expect(describeMixValidity([], "level")).toEqual({
			isValid: false,
			label: "Needs 1+ game",
		});
		expect(describeMixValidity(one, "level").isValid).toBe(true);
	});

	it("counts groups and games in the summary line", () => {
		expect(
			summarizeMix([{ variants: ["Razz", "Stud"] }, { variants: [] }])
		).toBe("2 groups · 2 games");
		expect(summarizeMix([{ variants: ["Razz"] }])).toBe("1 group · 1 game");
	});
});

describe("withDerivedAnteTypes", () => {
	it("stores no ante for a blank cell, keeps a big-blind ante, and treats any other ante as everyone's", () => {
		const base = toggleVariantInGroup(
			addEmptyGroup([], BIG_BET, "a"),
			"a",
			"NL Hold'em",
			groupFor
		)[0] as MixGameGroupRow;
		const rows: MixGameGroupRow[] = [
			{ ...base, ante: "", anteType: "all", uid: "blank" },
			{ ...base, ante: "200", anteType: "bb", uid: "bb" },
			{ ...base, ante: "50", anteType: "none", uid: "new" },
		];
		const stored = toMixGames(withDerivedAnteTypes(rows));
		expect(stored?.map(({ ante, anteType }) => ({ ante, anteType }))).toEqual([
			{ ante: null, anteType: "none" },
			{ ante: 200, anteType: "bb" },
			{ ante: 50, anteType: "all" },
		]);
	});
});

describe("variantForComposition", () => {
	const horse = [
		{ variants: ["NL Hold'em"] },
		{ variants: ["Limit Hold'em"] },
		{ variants: ["Razz", "Stud"] },
	];

	it("keeps a named mix while its games stay in the canonical buckets, ignoring names, stakes and casing", () => {
		const edited = [
			{ name: "Flop", variants: ["nl hold'em"] },
			{ variants: ["Limit Hold'em"] },
			{ variants: ["RAZZ", "Stud"] },
		];
		expect(variantForComposition("HORSE", edited, horse)).toBe("HORSE");
	});

	it("turns a named mix into a custom mix once its structure changes, so the server accepts it", () => {
		const moved = [
			{ variants: ["NL Hold'em", "Limit Hold'em"] },
			{ variants: ["Razz", "Stud"] },
		];
		expect(variantForComposition("HORSE", moved, horse)).toBe("mix");
		expect(variantForComposition("HORSE", horse.slice(0, 2), horse)).toBe(
			"mix"
		);
	});

	it("leaves a custom mix alone", () => {
		expect(variantForComposition("mix", [{ variants: ["Razz"] }], null)).toBe(
			"mix"
		);
	});
});

describe("describeMixStakesLine", () => {
	it("names each group by its name or family and shows missing blinds as a dash", () => {
		expect(
			describeMixStakesLine(
				[
					{ blind1: 100, blind2: 200, name: "Flop", variants: ["NL Hold'em"] },
					{
						blind1: null,
						blind2: 400,
						blind3: 50,
						name: "  ",
						variants: ["Razz"],
					},
				],
				groupFor
			)
		).toBe("Flop 100/200 · Stud —/400/50");
	});
});

describe("filterVariantOptions", () => {
	const options = [
		{ groupLabel: "Big Bet", label: "Pot Limit Omaha", shortLabel: "PLO" },
		{ groupLabel: "Stud", label: "Razz", shortLabel: null },
	];

	it("matches the name, the short code or the family, case-insensitively", () => {
		expect(filterVariantOptions(options, "plo")).toEqual([options[0]]);
		expect(filterVariantOptions(options, "omaha")).toEqual([options[0]]);
		expect(filterVariantOptions(options, " STUD")).toEqual([options[1]]);
		expect(filterVariantOptions(options, "")).toEqual(options);
	});
});
