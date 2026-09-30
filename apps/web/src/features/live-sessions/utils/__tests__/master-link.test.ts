import { describe, expect, it } from "vitest";
import {
	buildRingGameCreateInput,
	buildTournamentCreateInput,
	describeCashMasterMeta,
	describeSnapshotRows,
	describeTournamentMasterMeta,
	hasSameRules,
	masterNounFor,
	withRoomName,
} from "@/features/live-sessions/utils/master-link";

const CASH_META = {
	blind1: 100,
	blind2: 200,
	blind3: null,
	maxBuyIn: 60_000,
	minBuyIn: 20_000,
	mixGames: null,
	tableSize: 9,
	variant: "NLH",
};

describe("masterNounFor", () => {
	it("calls a cash master a ring game", () => {
		expect(masterNounFor("cash_game")).toBe("ring game");
		expect(masterNounFor("tournament")).toBe("tournament");
	});
});

describe("describeCashMasterMeta", () => {
	it("lists stakes, buy-in range and table size", () => {
		expect(describeCashMasterMeta(CASH_META)).toBe(
			"100/200 · buy-in 20,000–60,000 · 9-max"
		);
	});

	it("names a mixed master and takes its stakes from the groups", () => {
		expect(
			describeCashMasterMeta({
				blind1: null,
				blind2: null,
				blind3: null,
				maxBuyIn: null,
				minBuyIn: null,
				mixGames: [
					{ blind1: 200, blind2: 400, name: "Flop", variants: ["NLH", "PLO"] },
					{ blind1: 200, blind2: 400, variants: ["Razz"] },
					{ blind1: 100, blind2: 200, blind3: 25, variants: ["Stud"] },
				],
				tableSize: 8,
				variant: "HORSE",
			})
		).toBe("HORSE · 200/400, 100/200/25 · 8-max");
	});

	it("shows a single buy-in when only one bound is known", () => {
		expect(
			describeCashMasterMeta({
				...CASH_META,
				maxBuyIn: null,
				tableSize: null,
			})
		).toBe("100/200 · buy-in 20,000");
	});

	it("is empty when the master carries no rules", () => {
		expect(
			describeCashMasterMeta({
				blind1: null,
				blind2: null,
				blind3: null,
				maxBuyIn: null,
				minBuyIn: null,
				mixGames: null,
				tableSize: null,
				variant: "NLH",
			})
		).toBe("");
	});
});

describe("describeTournamentMasterMeta", () => {
	it("lists buy-in with fee, starting stack and table size", () => {
		expect(
			describeTournamentMasterMeta({
				buyIn: 10_000,
				entryFee: 1000,
				startingStack: 30_000,
				tableSize: 9,
			})
		).toBe("10,000 + 1,000 · 30,000 chips · 9-max");
	});

	it("drops the fee and missing parts", () => {
		expect(
			describeTournamentMasterMeta({
				buyIn: 5000,
				entryFee: null,
				startingStack: null,
				tableSize: null,
			})
		).toBe("5,000");
	});
});

describe("withRoomName", () => {
	it("prefixes the room and tolerates an empty meta", () => {
		expect(withRoomName("Club", "100/200")).toBe("Club · 100/200");
		expect(withRoomName("Club", "")).toBe("Club");
		expect(withRoomName(null, "100/200")).toBe("100/200");
	});
});

describe("describeSnapshotRows", () => {
	const NUMBERS = {
		blind1: 100,
		blind2: 200,
		entryFee: null,
		maxBuyIn: 60_000,
		minBuyIn: 20_000,
		startingStack: null,
		tournamentBuyIn: null,
	};
	const CASH_SOURCE = {
		blindLabels: { blind1: "SB", blind2: "BB" },
		blindLevelCount: 0,
		currencyName: "Yen",
		currencyUnit: "¥",
		isMix: false,
		mixGames: [],
		numbers: NUMBERS,
		sessionType: "cash_game" as const,
		tableSize: 9,
		variant: "NLH",
	};

	const valuesOf = (rows: ReturnType<typeof describeSnapshotRows>) =>
		Object.fromEntries(rows.map((row) => [row.label, row.value]));

	it("lists a cash snapshot under the variant's blind labels with money units", () => {
		expect(valuesOf(describeSnapshotRows(CASH_SOURCE))).toEqual({
			"Buy-in": "¥20,000 – ¥60,000",
			Currency: "Yen · ¥",
			"Game type": "NLH",
			"SB / BB": "¥100 / ¥200",
			"Table size": "9-max",
		});
	});

	it("counts a mix's games and takes its stakes from the groups", () => {
		expect(
			valuesOf(
				describeSnapshotRows({
					...CASH_SOURCE,
					currencyName: null,
					currencyUnit: null,
					isMix: true,
					mixGames: [
						{ blind1: 200, blind2: 400, variants: ["NLH", "PLO"] },
						{
							blind1: 100,
							blind2: 200,
							blind3: 25,
							variants: ["Razz", "Stud"],
						},
					],
					numbers: {
						...NUMBERS,
						blind1: null,
						blind2: null,
						maxBuyIn: null,
						minBuyIn: null,
					},
					tableSize: null,
					variant: "HORSE",
				})
			)
		).toEqual({
			"Buy-in": "—",
			Currency: "Not set",
			"Game type": "HORSE · 4 games",
			Stakes: "200/400, 100/200/25",
			"Table size": "—",
		});
	});

	it("lists a tournament snapshot with its fee, stack and playable levels", () => {
		expect(
			valuesOf(
				describeSnapshotRows({
					...CASH_SOURCE,
					blindLevelCount: 1,
					currencyName: "Dollar",
					currencyUnit: "$",
					numbers: {
						...NUMBERS,
						entryFee: 5,
						startingStack: 15_000,
						tournamentBuyIn: 50,
					},
					sessionType: "tournament",
				})
			)
		).toEqual({
			"Buy-in": "$50 + $5",
			Currency: "Dollar · $",
			"Game type": "NLH",
			Levels: "1 level",
			"Starting stack": "15,000 chips",
		});
	});
});

describe("hasSameRules", () => {
	const master = {
		ante: "",
		anteType: "none",
		blind1: "100",
		blind2: "200",
		currencyId: "cur-a",
		ruleName: "NLH 100/200",
	};

	it("ignores the name and the currency", () => {
		expect(
			hasSameRules(master, {
				...master,
				currencyId: "cur-b",
				ruleName: "Friday game",
			})
		).toBe(true);
	});

	it("reports a differing rule", () => {
		expect(hasSameRules(master, { ...master, blind2: "250" })).toBe(false);
	});

	it("treats a field the session has not set as blank", () => {
		const { ante: _, ...withoutAnte } = master;
		expect(hasSameRules(master, withoutAnte)).toBe(true);
		expect(hasSameRules({ ...master, ante: "50" }, withoutAnte)).toBe(false);
	});

	it("compares house rules as a rule, ignoring line endings and outer whitespace", () => {
		const withRules = { ...master, houseRules: "No straddle\nTip 1%" };
		expect(
			hasSameRules(withRules, {
				...withRules,
				houseRules: "No straddle\r\nTip 1%\n",
			})
		).toBe(true);
		expect(
			hasSameRules(withRules, { ...withRules, houseRules: "No straddle" })
		).toBe(false);
	});

	it("never matches without both sides", () => {
		expect(hasSameRules(null, master)).toBe(false);
		expect(hasSameRules(master, null)).toBe(false);
	});
});

describe("buildRingGameCreateInput", () => {
	it("copies the snapshot and omits the fields the session left unset", () => {
		expect(
			buildRingGameCreateInput(
				{ currencyId: null, name: "  Friday game ", roomId: "room-1" },
				{
					ante: null,
					anteType: "straddle",
					blind1: 100,
					blind2: 200,
					blind3: null,
					houseRules: null,
					maxBuyIn: 60_000,
					minBuyIn: null,
					mixGames: null,
					tableSize: 9,
					variant: "NLH",
				}
			)
		).toEqual({
			blind1: 100,
			blind2: 200,
			maxBuyIn: 60_000,
			mixGames: null,
			name: "Friday game",
			roomId: "room-1",
			tableSize: 9,
			variant: "NLH",
		});
	});

	it("keeps a known ante type, the currency and the mix composition", () => {
		const mixGames = [
			{
				ante: null,
				blind1: 200,
				blind2: 400,
				blind3: null,
				name: "Flop",
				variants: ["NLH", "PLO"],
			},
		];
		expect(
			buildRingGameCreateInput(
				{ currencyId: "cur-1", name: "Mix", roomId: "room-1" },
				{
					ante: 50,
					anteType: "bb",
					blind1: null,
					blind2: null,
					blind3: null,
					houseRules: "Straddle UTG only",
					maxBuyIn: null,
					minBuyIn: null,
					mixGames,
					tableSize: null,
					variant: "mix",
				}
			)
		).toEqual({
			ante: 50,
			anteType: "bb",
			currencyId: "cur-1",
			houseRules: "Straddle UTG only",
			mixGames,
			name: "Mix",
			roomId: "room-1",
			variant: "mix",
		});
	});
});

describe("buildTournamentCreateInput", () => {
	it("copies the snapshot with its blind structure and chip purchases", () => {
		expect(
			buildTournamentCreateInput(
				{ currencyId: "cur-1", name: " Weekend Turbo ", roomId: "room-1" },
				{
					bountyAmount: null,
					buyIn: 5000,
					entryFee: 500,
					houseRules: null,
					startingStack: 15_000,
					tableSize: null,
					variant: "NLH",
				},
				[
					{
						ante: 100,
						blind1: 50,
						blind2: 100,
						blind3: null,
						isBreak: false,
						minutes: 10,
					},
					{
						ante: null,
						blind1: null,
						blind2: null,
						blind3: null,
						games: null,
						isBreak: true,
						minutes: 5,
					},
				],
				[{ chips: 10_000, cost: 2000, name: "Add-on" }]
			)
		).toEqual({
			blindLevels: [
				{
					ante: 100,
					blind1: 50,
					blind2: 100,
					blind3: null,
					games: null,
					isBreak: false,
					minutes: 10,
				},
				{
					ante: null,
					blind1: null,
					blind2: null,
					blind3: null,
					games: null,
					isBreak: true,
					minutes: 5,
				},
			],
			buyIn: 5000,
			chipPurchases: [{ chips: 10_000, cost: 2000, name: "Add-on" }],
			currencyId: "cur-1",
			entryFee: 500,
			name: "Weekend Turbo",
			roomId: "room-1",
			startingStack: 15_000,
			variant: "NLH",
		});
	});
});
