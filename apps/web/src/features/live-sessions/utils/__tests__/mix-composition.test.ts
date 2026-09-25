import { describe, expect, it } from "vitest";
import {
	type MixGroupInfo,
	rowsFromVariantLabels,
	updateGroup,
} from "@/shared/lib/mix-games";
import {
	autoGroupNames,
	describeMixValidity,
	filterVariantOptions,
	levelGroupsFor,
	matchMixLabel,
	seedMixGroups,
	serializeMixGroups,
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

describe("describeMixValidity", () => {
	it("needs two games for a cash mix", () => {
		expect(describeMixValidity([{ variants: ["Razz"] }])).toEqual({
			isValid: false,
			label: "Needs 2+ games",
		});
		expect(
			describeMixValidity([
				{ variants: ["Razz"] },
				{ variants: ["NL Hold'em"] },
			]).isValid
		).toBe(true);
	});

	it("rejects a group without games even when the mix has enough games", () => {
		expect(
			describeMixValidity([
				{ variants: ["Limit Hold'em", "Omaha Hi-Lo"] },
				{ variants: [] },
			])
		).toEqual({ isValid: false, label: "Group 2 has no games" });
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

describe("matchMixLabel", () => {
	const candidates = [
		{
			groups: rowsFromVariantLabels(
				["Limit Hold'em", "Razz", "Stud"],
				groupFor
			),
			label: "HORSE",
		},
		{
			groups: rowsFromVariantLabels(["NL Hold'em", "Razz"], groupFor),
			label: "Mini",
		},
	];

	it("finds the mix whose games a level uses, ignoring group names, stakes and casing", () => {
		expect(
			matchMixLabel(
				[
					{ name: "Flop", variants: ["limit hold'em"] },
					{ variants: ["RAZZ", "Stud"] },
				],
				candidates
			)
		).toBe("HORSE");
	});

	it("finds nothing for an empty or unmatched composition", () => {
		expect(matchMixLabel([], candidates)).toBeNull();
		expect(
			matchMixLabel([{ variants: ["Limit Hold'em", "Razz"] }], candidates)
		).toBeNull();
	});
});

describe("levelGroupsFor", () => {
	it("names a single game's group after the game", () => {
		expect(levelGroupsFor([], ["Razz"], groupFor)).toEqual([
			expect.objectContaining({ name: "Razz", variants: ["Razz"] }),
		]);
	});

	it("keeps the stakes of a structure the new games share, and leaves the others blank", () => {
		const razz = levelGroupsFor([], ["Razz"], groupFor);
		const single = updateGroup(razz, razz[0]?.uid ?? "", {
			blind1: "200",
			blind2: "400",
			blind3: "50",
		});
		const mixed = levelGroupsFor(
			single,
			["Limit Hold'em", "Razz", "Stud"],
			groupFor
		);
		expect(mixed).toEqual([
			expect.objectContaining({
				blind1: "",
				name: null,
				variants: ["Limit Hold'em"],
			}),
			expect.objectContaining({
				blind1: "200",
				blind2: "400",
				blind3: "50",
				name: null,
				variants: ["Razz", "Stud"],
			}),
		]);
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
