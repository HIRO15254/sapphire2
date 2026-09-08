import { describe, expect, it } from "vitest";
import {
	currencyRowLabel,
	currencySample,
	describeMasterLink,
	filterTagCandidates,
	findExactTag,
	formatWithUnit,
} from "../session-settings";

const TAGS = [
	{ id: "t1", name: "Weekend", usageCount: 12 },
	{ id: "t2", name: "Trip: Osaka", usageCount: 3 },
	{ id: "t3", name: "Tilt", usageCount: 1 },
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

	it("formats the picker sample with the same rule", () => {
		expect(currencySample("$")).toBe("$51,800");
		expect(currencySample("chips")).toBe("51,800 chips");
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

describe("filterTagCandidates", () => {
	it("hides already-selected tags and matches case-insensitively on a substring", () => {
		expect(filterTagCandidates(TAGS, ["t3"], "T")).toEqual([TAGS[1]]);
		expect(filterTagCandidates(TAGS, [], "OSAKA")).toEqual([TAGS[1]]);
	});

	it("returns every unselected tag for an empty query", () => {
		expect(filterTagCandidates(TAGS, ["t2"], "  ")).toEqual([TAGS[0], TAGS[2]]);
	});
});

describe("findExactTag", () => {
	it("matches a whole name ignoring case and surrounding space", () => {
		expect(findExactTag(TAGS, "  weekend ")).toEqual(TAGS[0]);
	});

	it("returns null for a partial name or an empty one", () => {
		expect(findExactTag(TAGS, "week")).toBeNull();
		expect(findExactTag(TAGS, "   ")).toBeNull();
	});
});
