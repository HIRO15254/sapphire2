import { describe, expect, it } from "vitest";
import {
	currencyRowLabel,
	describeCashMasterValues,
	describeMasterLink,
	describeTournamentMasterValues,
	findCurrency,
	formatWithUnit,
	isMasterFieldDifferent,
} from "../session-settings";

const CURRENCIES = [
	{ id: "c1", name: "Japanese yen", unit: "¥" },
	{ id: "c2", name: "Club chips", unit: "chips" },
];

describe("formatWithUnit", () => {
	it("puts a single-character unit in front and anything longer behind", () => {
		expect(formatWithUnit(51_800, "¥")).toBe("¥51,800");
		expect(formatWithUnit(51_800, "chips")).toBe("51,800 chips");
		expect(formatWithUnit(51_800, "pt")).toBe("51,800 pt");
	});

	it("drops the unit entirely when there is none", () => {
		expect(formatWithUnit(51_800, null)).toBe("51,800");
		expect(formatWithUnit(51_800, "")).toBe("51,800");
	});
});

describe("currencyRowLabel", () => {
	it("shows the unit before the name, and copes with a missing currency or unit", () => {
		expect(
			currencyRowLabel({ id: "c1", name: "Japanese yen", unit: "¥" })
		).toBe("¥ Japanese yen");
		expect(
			currencyRowLabel({ id: "c1", name: "Club points", unit: null })
		).toBe("Club points");
		expect(currencyRowLabel(null)).toBe("Not set");
	});
});

describe("findCurrency", () => {
	it("finds the matching currency by id", () => {
		expect(findCurrency(CURRENCIES, "c2")).toEqual(CURRENCIES[1]);
	});

	it("returns null for an unknown or empty id", () => {
		expect(findCurrency(CURRENCIES, "missing")).toBeNull();
		expect(findCurrency(CURRENCIES, "")).toBeNull();
	});
});

describe("describeMasterLink", () => {
	it("names the master kind while unlinked and offers Link", () => {
		expect(describeMasterLink(null, "cash_game")).toMatchObject({
			action: "Link",
			title: "Not linked to a ring game",
		});
		expect(describeMasterLink(null, "tournament")).toMatchObject({
			action: "Link",
			title: "Not linked to a tournament",
		});
	});

	it("shows the linked master and offers Change", () => {
		expect(describeMasterLink("NLH 100/200", "cash_game")).toMatchObject({
			action: "Change",
			title: "NLH 100/200",
		});
	});
});

describe("describeCashMasterValues", () => {
	it("maps null numeric fields to empty strings and a null ante type to none", () => {
		expect(
			describeCashMasterValues({
				ante: null,
				anteType: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				currencyId: null,
				maxBuyIn: null,
				minBuyIn: 20_000,
				name: "Friday game",
				tableSize: 9,
			})
		).toEqual({
			ante: "",
			anteType: "none",
			blind1: "100",
			blind2: "200",
			blind3: "",
			currencyId: "",
			maxBuyIn: "",
			minBuyIn: "20000",
			ruleName: "Friday game",
			tableSize: "9",
		});
	});

	it("returns null for a null master", () => {
		expect(describeCashMasterValues(null)).toBeNull();
	});
});

describe("describeTournamentMasterValues", () => {
	it("maps buyIn to tournamentBuyIn and null numeric fields to empty strings", () => {
		expect(
			describeTournamentMasterValues({
				bountyAmount: null,
				buyIn: 5000,
				currencyId: "cur-1",
				entryFee: 500,
				name: "Sunday special",
				startingStack: null,
				tableSize: 9,
			})
		).toEqual({
			bountyAmount: "",
			currencyId: "cur-1",
			entryFee: "500",
			ruleName: "Sunday special",
			startingStack: "",
			tableSize: "9",
			tournamentBuyIn: "5000",
		});
	});

	it("returns null for a null master", () => {
		expect(describeTournamentMasterValues(null)).toBeNull();
	});
});

describe("isMasterFieldDifferent", () => {
	const master = describeCashMasterValues({
		ante: null,
		anteType: "none",
		blind1: 100,
		blind2: 200,
		blind3: null,
		currencyId: "cur-1",
		maxBuyIn: null,
		minBuyIn: null,
		name: "Friday game",
		tableSize: 9,
	});

	it("is false when there is no master to compare against", () => {
		expect(isMasterFieldDifferent(null, "blind2", "999")).toBe(false);
	});

	it("is false when the current value matches the master", () => {
		expect(isMasterFieldDifferent(master, "blind2", "200")).toBe(false);
	});

	it("is true when the current value diverges from the master", () => {
		expect(isMasterFieldDifferent(master, "blind2", "400")).toBe(true);
	});

	it("is false for a key the master does not carry (tournament-only key on a cash master)", () => {
		expect(isMasterFieldDifferent(master, "entryFee", "500")).toBe(false);
	});
});
