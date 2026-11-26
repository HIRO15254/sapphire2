import { describe, expect, it } from "vitest";
import {
	bigBet,
	gameMix,
	limit,
	masterGroups,
	masterVariants,
	stud,
} from "@/features/games/__tests__/fixtures";
import {
	amountError,
	applyAnteType,
	hasStakeErrors,
	type LineupSlot,
	reseedStakes,
	type StakeDraft,
	slotNames,
	slotsForMix,
	stakesFromSaved,
	toStakeInputs,
	withAnteType,
} from "../stakes";

function draft(
	slot: LineupSlot,
	amounts: Partial<StakeDraft> = {}
): StakeDraft {
	return {
		...slot,
		ante: "",
		anteType: null,
		blind1: "",
		blind2: "",
		blind3: "",
		...amounts,
	};
}

const limitSlot = { gameGroupId: "limit", name: null, variantIds: ["lhe"] };
const bigBetSlot = { gameGroupId: "big-bet", name: null, variantIds: ["nlh"] };

describe("slotsForMix", () => {
	it("groups a mix's games by their structure in first-appearance order", () => {
		const mix = gameMix({ games: ["lhe", "nlh", "razz", "plo"], id: "mix" });

		expect(slotsForMix(mix, masterVariants)).toEqual([
			{ gameGroupId: "limit", name: null, variantIds: ["lhe"] },
			{ gameGroupId: "big-bet", name: null, variantIds: ["nlh", "plo"] },
			{ gameGroupId: "stud", name: null, variantIds: ["razz"] },
		]);
	});
});

describe("reseedStakes", () => {
	it("keeps amounts of structures that remain and starts new ones empty", () => {
		const previous = [
			draft(limitSlot, { blind1: "400", blind2: "800" }),
			draft(bigBetSlot, { blind1: "100", blind2: "200" }),
		];
		const next = reseedStakes(
			previous,
			[
				{ gameGroupId: "big-bet", name: null, variantIds: ["nlh", "plo"] },
				{ gameGroupId: "stud", name: null, variantIds: ["razz"] },
			],
			masterGroups
		);

		expect(next).toEqual([
			draft(
				{ gameGroupId: "big-bet", name: null, variantIds: ["nlh", "plo"] },
				{ blind1: "100", blind2: "200" }
			),
			draft(
				{ gameGroupId: "stud", name: null, variantIds: ["razz"] },
				{ anteType: "all" }
			),
		]);
	});

	it("carries repeated structures by occurrence without mixing their amounts", () => {
		const first = {
			gameGroupId: "big-bet",
			name: "Round 1",
			variantIds: ["nlh"],
		};
		const second = {
			gameGroupId: "big-bet",
			name: "Round 2",
			variantIds: ["plo"],
		};
		const previous = [
			draft(first, { blind1: "400", blind2: "800" }),
			draft(second, { blind1: "100", blind2: "200" }),
		];

		const next = reseedStakes(previous, [first, second], masterGroups);

		expect(next.map((stake) => [stake.blind1, stake.blind2])).toEqual([
			["400", "800"],
			["100", "200"],
		]);
	});
});

describe("amountError", () => {
	it.each(["", " ", "0", "1", "200", "007"])("accepts %j", (text) => {
		expect(amountError(text)).toBeNull();
	});

	it.each([
		"1.5",
		"-3",
		"-0.5",
		"abc",
		"1a",
		"NaN",
		"Infinity",
		"1 2",
		"100.5",
		"10px",
		"9007199254740993",
	])("rejects %j as a whole number", (text) => {
		expect(amountError(text)).not.toBeNull();
	});
});

describe("hasStakeErrors", () => {
	it("flags a blank required blind and an invalid amount in any field", () => {
		const valid = draft(bigBetSlot, { blind1: "1", blind2: "2" });

		expect(hasStakeErrors([valid], masterGroups)).toBe(false);
		expect(hasStakeErrors([{ ...valid, blind2: "" }], masterGroups)).toBe(true);
		expect(
			hasStakeErrors(
				[{ ...valid, ante: "1.5", anteType: "bb" as const }],
				masterGroups
			)
		).toBe(true);
	});
});

describe("withAnteType", () => {
	it("clears the amount when nobody pays and keeps it between payers", () => {
		const paid = draft(bigBetSlot, { ante: "75", anteType: "all" });

		expect(withAnteType(paid, "none")).toMatchObject({
			ante: "",
			anteType: "none",
		});
		expect(withAnteType(paid, "bb")).toMatchObject({
			ante: "75",
			anteType: "bb",
		});
	});
});

describe("toStakeInputs", () => {
	it("sends blanks as null, drops a stale unpaid ante and applies the fixed type", () => {
		const stakes = [
			draft(limitSlot, {
				ante: "50",
				anteType: "none",
				blind1: " 400 ",
				blind2: "800",
				blind3: "5",
			}),
			draft(
				{ gameGroupId: "stud", name: null, variantIds: ["razz"] },
				{ ante: "25", anteType: "bb", blind1: "10", blind2: "20", blind3: "" }
			),
		];

		expect(toStakeInputs(stakes, masterGroups)).toEqual([
			{
				ante: null,
				anteType: "none",
				blind1: 400,
				blind2: 800,
				blind3: null,
				gameGroupId: "limit",
			},
			{
				ante: 25,
				anteType: "all",
				blind1: 10,
				blind2: 20,
				blind3: null,
				gameGroupId: "stud",
			},
		]);
	});

	it("round-trips saved stakes without inventing values", () => {
		const saved = {
			ante: null,
			anteType: null,
			blind1: 1,
			blind2: 2,
			blind3: null,
		};

		const [restored] = toStakeInputs(
			stakesFromSaved([bigBetSlot], [saved]),
			masterGroups
		);

		expect(restored).toEqual({ ...saved, gameGroupId: "big-bet" });
	});
});

describe("slotNames", () => {
	it("prefers a stored name and numbers a structure that repeats", () => {
		const slots = [
			{ gameGroupId: "big-bet", name: null, variantIds: ["nlh"] },
			{ gameGroupId: "big-bet", name: null, variantIds: ["plo"] },
			{ gameGroupId: "limit", name: "Round 1", variantIds: ["lhe"] },
		];

		expect(slotNames(slots, [bigBet, limit, stud])).toEqual([
			"Big Bet 1",
			"Big Bet 2",
			"Round 1",
		]);
	});
});

describe("applyAnteType", () => {
	it("sets the type on every level of one structure and skips breaks", () => {
		const level = [
			draft(limitSlot, { ante: "100", anteType: "bb" }),
			draft(bigBetSlot, { ante: "200", anteType: "bb" }),
		];

		const next = applyAnteType([level, null, level], 0, "none");

		expect(next[1]).toBeNull();
		for (const stakes of [next[0], next[2]]) {
			expect(stakes?.[0]).toMatchObject({ ante: "", anteType: "none" });
			expect(stakes?.[1]).toMatchObject({ ante: "200", anteType: "bb" });
		}
	});
});
