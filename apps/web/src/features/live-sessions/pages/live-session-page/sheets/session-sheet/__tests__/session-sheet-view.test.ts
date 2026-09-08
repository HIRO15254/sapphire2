import { describe, expect, it } from "vitest";
import { describeSessionDetail } from "../session-sheet-view";

const CASH_DETAIL = {
	cashAnte: 100,
	cashAnteType: "bb",
	cashBlind1: 100,
	cashBlind3: null,
	cashMaxBuyIn: 60_000,
	cashMinBuyIn: 20_000,
	cashTableSize: 9,
	cashVariant: "NL Hold'em",
	currencyId: "cur-1",
	currencyName: "Japanese yen",
	currencyUnit: "¥",
	memo: "Deep table",
	ringGameBlind2: 200,
	ringGameId: null,
	ringGameName: "NLH 100/200",
	roomName: "Grand Room Umeda",
	tags: [{ id: "t1", name: "Weekend" }],
	tournamentName: "Daily Deepstack",
	tournamentTableSize: 8,
	tournamentVariant: "Pot Limit Omaha",
};

describe("describeSessionDetail", () => {
	it("reads the cash columns for a cash session", () => {
		const view = describeSessionDetail(CASH_DETAIL, "cash_game");
		expect(view).toMatchObject({
			anteType: "bb",
			currencyLabel: "¥ Japanese yen",
			roomName: "Grand Room Umeda",
			ruleName: "NLH 100/200",
			tableSize: 9,
			variantLabel: "NL Hold'em",
		});
		expect(view.serverNumbers).toMatchObject({
			ante: 100,
			blind1: 100,
			blind2: 200,
			maxBuyIn: 60_000,
			minBuyIn: 20_000,
		});
	});

	it("reads the tournament columns for a tournament session", () => {
		const view = describeSessionDetail(
			{
				...CASH_DETAIL,
				entryFee: 1000,
				tournamentBountyAmount: 0,
				tournamentBuyIn: 10_000,
				tournamentStartingStack: 30_000,
			},
			"tournament"
		);
		expect(view).toMatchObject({
			ruleName: "Daily Deepstack",
			tableSize: 8,
			variantLabel: "Pot Limit Omaha",
		});
		expect(view.serverNumbers).toMatchObject({
			bountyAmount: 0,
			entryFee: 1000,
			startingStack: 30_000,
			tournamentBuyIn: 10_000,
		});
	});

	it("marks the master unlinked when the session carries no master id", () => {
		expect(describeSessionDetail(CASH_DETAIL, "cash_game")).toMatchObject({
			isMasterLinked: false,
			master: { action: "Link", title: "Not linked to a ring game" },
		});
		expect(
			describeSessionDetail({ ...CASH_DETAIL, ringGameId: "rg-1" }, "cash_game")
		).toMatchObject({
			isMasterLinked: true,
			master: { action: "Change" },
		});
	});

	it("falls back to none for an ante type the picker cannot show", () => {
		expect(
			describeSessionDetail({ cashAnteType: "straddle" }, "cash_game").anteType
		).toBe("none");
	});

	it("renders an empty session without throwing", () => {
		expect(describeSessionDetail(null, "cash_game")).toMatchObject({
			currencyLabel: "Not set",
			memo: "",
			roomName: "Not set",
			ruleName: "",
			selectedCurrencyId: null,
			tableSize: null,
			tags: [],
		});
	});
});
