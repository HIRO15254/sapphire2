import { describe, expect, it } from "vitest";
import {
	formatRingGameBlinds,
	formatTournamentBuyIn,
} from "@/features/rooms/utils/game-format";

const ringGame = (
	overrides: Partial<{
		ante: number | null;
		anteType: string | null;
		blind1: number | null;
		blind2: number | null;
		blind3: number | null;
	}> = {}
) => ({
	ante: null,
	anteType: "none" as string | null,
	blind1: null,
	blind2: null,
	blind3: null,
	...overrides,
});

describe("formatRingGameBlinds", () => {
	it("joins small blinds with a slash", () => {
		expect(formatRingGameBlinds(ringGame({ blind1: 1, blind2: 2 }))).toBe(
			"1/2"
		);
	});

	it("includes a third blind (straddle) when present", () => {
		expect(
			formatRingGameBlinds(ringGame({ blind1: 1, blind2: 2, blind3: 4 }))
		).toBe("1/2/4");
	});

	it("renders an em dash for a missing big blind after a small blind", () => {
		expect(formatRingGameBlinds(ringGame({ blind1: 1 }))).toBe("1/—");
	});

	it("returns an empty string when no blinds are set", () => {
		expect(formatRingGameBlinds(ringGame())).toBe("");
	});

	it("appends a BB ante in parentheses", () => {
		expect(
			formatRingGameBlinds(
				ringGame({ blind1: 1, blind2: 2, ante: 2, anteType: "bb" })
			)
		).toBe("1/2 (BBA:2)");
	});

	it("appends an all-ante in parentheses", () => {
		expect(
			formatRingGameBlinds(
				ringGame({ blind1: 1, blind2: 2, ante: 1, anteType: "all" })
			)
		).toBe("1/2 (Ante:1)");
	});

	it("omits the ante when anteType is none", () => {
		expect(
			formatRingGameBlinds(
				ringGame({ blind1: 1, blind2: 2, ante: 5, anteType: "none" })
			)
		).toBe("1/2");
	});

	it("omits the ante when anteType is null", () => {
		expect(
			formatRingGameBlinds(
				ringGame({ blind1: 1, blind2: 2, ante: 5, anteType: null })
			)
		).toBe("1/2");
	});

	it("appends the currency unit when provided", () => {
		expect(formatRingGameBlinds(ringGame({ blind1: 1, blind2: 2 }), "$")).toBe(
			"1/2 $"
		);
	});

	it("ignores a null currency unit", () => {
		expect(formatRingGameBlinds(ringGame({ blind1: 1, blind2: 2 }), null)).toBe(
			"1/2"
		);
	});

	it("applies a shared compact tier across large blinds", () => {
		expect(
			formatRingGameBlinds(ringGame({ blind1: 5000, blind2: 10_000 }))
		).toBe("5k/10k");
	});
});

describe("formatTournamentBuyIn", () => {
	it("returns an empty string when buyIn is null", () => {
		expect(formatTournamentBuyIn({ buyIn: null, entryFee: 5 })).toBe("");
	});

	it("renders just the buy-in when no entry fee", () => {
		expect(formatTournamentBuyIn({ buyIn: 100, entryFee: null })).toBe("100");
	});

	it("renders buyIn+entryFee when both are present", () => {
		expect(formatTournamentBuyIn({ buyIn: 100, entryFee: 20 })).toBe("100+20");
	});

	it("appends the currency unit with a leading space", () => {
		expect(formatTournamentBuyIn({ buyIn: 100, entryFee: 20 }, "$")).toBe(
			"100+20 $"
		);
	});

	it("appends the unit even without an entry fee", () => {
		expect(formatTournamentBuyIn({ buyIn: 100, entryFee: null }, "$")).toBe(
			"100 $"
		);
	});

	it("ignores a null unit", () => {
		expect(formatTournamentBuyIn({ buyIn: 100, entryFee: null }, null)).toBe(
			"100"
		);
	});
});

describe("formatRingGameBlinds — mix games", () => {
	const mixGames = [
		{
			name: "Limit",
			variants: ["lhe", "o8"],
			blind1: 400,
			blind2: 800,
			blind3: null,
			ante: null,
			anteType: null,
		},
		{
			name: null,
			variants: ["nlh", "plo"],
			blind1: 100,
			blind2: 200,
			blind3: null,
			ante: null,
			anteType: null,
		},
	];

	it("renders the grouped mix summary instead of the flat blinds", () => {
		const result = formatRingGameBlinds({
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
			mixGames,
		});
		expect(result).toBe("Mix · Limit 400/800 · NLH+PLO 100/200");
	});

	it("appends the currency unit after the mix summary", () => {
		const result = formatRingGameBlinds(
			{
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
				anteType: null,
				mixGames,
			},
			"chips"
		);
		expect(result).toBe("Mix · Limit 400/800 · NLH+PLO 100/200 chips");
	});

	it("ignores an empty mixGames array and falls back to flat blinds", () => {
		const result = formatRingGameBlinds({
			blind1: 1,
			blind2: 2,
			blind3: null,
			ante: null,
			anteType: null,
			mixGames: [],
		});
		expect(result).toBe("1/2");
	});
});
