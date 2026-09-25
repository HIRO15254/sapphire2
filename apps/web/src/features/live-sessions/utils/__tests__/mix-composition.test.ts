import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { describe, expect, it } from "vitest";
import {
	type MixGameGroupRow,
	type MixGroupInfo,
	updateGroup,
} from "@/shared/lib/mix-games";
import {
	addEmptyGroup,
	autoGroupNames,
	canToggleVariantInGroup,
	describeMixStakesLine,
	describeMixValidity,
	filterVariantOptions,
	seedMixGroups,
	serializeMixGroups,
	summarizeMix,
	toggleVariantInGroup,
	variantForComposition,
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
	it("takes the blind structure from the first game and then only accepts games sharing it", () => {
		const rows = toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor);
		expect(rows[0]).toMatchObject({
			blind1Label: "Small Bet",
			blind3Label: "Bring-in",
			groupLabel: "Stud",
			variants: ["Razz"],
		});
		expect(toggleVariantInGroup(rows, "a", "NL Hold'em", groupFor)).toEqual(
			rows
		);
		expect(
			toggleVariantInGroup(rows, "a", "Stud", groupFor)[0]?.variants
		).toEqual(["Razz", "Stud"]);
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

	it("keeps an emptied group's stakes for a game of the same structure but drops them for another structure", () => {
		const staked = updateGroup(
			toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor),
			"a",
			{ ante: "25", anteType: "all", blind1: "200", blind2: "400" }
		);
		const emptied = toggleVariantInGroup(staked, "a", "Razz", groupFor);

		expect(
			toggleVariantInGroup(emptied, "a", "Stud", groupFor)[0]
		).toMatchObject({
			ante: "25",
			anteType: "all",
			blind1: "200",
			blind2: "400",
		});
		expect(
			toggleVariantInGroup(emptied, "a", "NL Hold'em", groupFor)[0]
		).toMatchObject({
			ante: "",
			anteType: "none",
			blind1: "",
			blind2: "",
			groupLabel: "Big Bet",
		});
	});
});

describe("canToggleVariantInGroup", () => {
	it("lets an empty group take any free game and a filled group only its own structure or its own picks", () => {
		const rows = toggleVariantInGroup(twoEmptyGroups(), "a", "Razz", groupFor);
		expect(canToggleVariantInGroup(rows, "a", "Razz", groupFor)).toBe(true);
		expect(canToggleVariantInGroup(rows, "a", "Stud", groupFor)).toBe(true);
		expect(canToggleVariantInGroup(rows, "a", "Limit Hold'em", groupFor)).toBe(
			false
		);
		expect(canToggleVariantInGroup(rows, "b", "Limit Hold'em", groupFor)).toBe(
			true
		);
		expect(canToggleVariantInGroup(rows, "b", "Razz", groupFor)).toBe(false);
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

	it("rejects a group without games even when the mix has enough games", () => {
		expect(
			describeMixValidity(
				[{ variants: ["Limit Hold'em", "Omaha Hi-Lo"] }, { variants: [] }],
				"cash"
			)
		).toEqual({ isValid: false, label: "Group 2 has no games" });
		expect(
			describeMixValidity([{ variants: [] }, { variants: ["Razz"] }], "level")
				.isValid
		).toBe(false);
	});

	it("counts groups and games in the summary line", () => {
		expect(
			summarizeMix([{ variants: ["Razz", "Stud"] }, { variants: [] }])
		).toBe("2 groups · 2 games");
		expect(summarizeMix([{ variants: ["Razz"] }])).toBe("1 group · 1 game");
	});
});

describe("autoGroupNames", () => {
	it("names each group after its blind structure, numbers a structure that repeats, and leaves an empty group unnamed", () => {
		expect(
			autoGroupNames(
				[
					{ variants: ["NL Hold'em"] },
					{ variants: ["Razz"] },
					{ variants: ["Limit Hold'em"] },
					{ variants: ["Stud"] },
					{ variants: [] },
				],
				groupFor
			)
		).toEqual(["Big Bet", "Stud 1", "Limit", "Stud 2", ""]);
	});
});

describe("seedMixGroups / serializeMixGroups", () => {
	const stored = [
		{
			ante: null,
			anteType: "none" as const,
			blind1: 100,
			blind2: 200,
			blind3: null,
			name: "Stud 2",
			variants: ["Razz"],
		},
		{
			ante: null,
			anteType: "none" as const,
			blind1: null,
			blind2: null,
			blind3: null,
			name: "Flop",
			variants: ["NL Hold'em"],
		},
	];

	it("seeds the same rows every time so an untouched form is not re-seeded on each render", () => {
		expect(seedMixGroups(stored, groupFor)).toEqual(
			seedMixGroups(stored, groupFor)
		);
	});

	it("treats a stored default-looking name as automatic, keeps a custom one, and saves the resolved names", () => {
		const rows = seedMixGroups(stored, groupFor);
		expect(rows.map((row) => row.name)).toEqual([null, "Flop"]);
		expect(
			serializeMixGroups(rows, groupFor)?.map((group) => group.name)
		).toEqual(["Stud", "Flop"]);
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
