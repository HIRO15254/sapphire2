import { describe, expect, it } from "vitest";
import {
	type BlindLevelRow,
	breakRow,
	defaultLevelMinutes,
	hasBlindRowErrors,
	labelBlindRows,
	nextLevelRow,
	sameBlindStructure,
	summarizeBlindRows,
	toBlindLevelInputs,
	toBlindLevelRows,
} from "../blind-level-rows";

function level(
	uid: string,
	blind1: string,
	blind2: string,
	minutes = "20"
): BlindLevelRow {
	return {
		ante: "",
		blind1,
		blind2,
		blind3: "",
		games: null,
		isBreak: false,
		minutes,
		uid,
	};
}

describe("nextLevelRow", () => {
	it("grows the small blind by a quarter, rounded to 100, with a big blind and ante of twice that", () => {
		const row = nextLevelRow([level("1", "400", "800")], "15", "new");
		expect(row).toMatchObject({
			ante: "1000",
			blind1: "500",
			blind2: "1000",
			isBreak: false,
			minutes: "15",
		});
	});

	it("starts at 100/200 without a previous level and skips breaks when finding it", () => {
		expect(nextLevelRow([], "20", "new")).toMatchObject({
			blind1: "100",
			blind2: "200",
		});
		expect(
			nextLevelRow([level("1", "800", "1600"), breakRow("br")], "20", "new")
		).toMatchObject({ blind1: "1000" });
	});

	it("always moves up even when rounding would repeat or shrink the previous small blind", () => {
		expect(nextLevelRow([level("1", "100", "200")], "20", "n").blind1).toBe(
			"200"
		);
		expect(nextLevelRow([level("1", "25", "50")], "20", "n").blind1).toBe(
			"100"
		);
	});
});

describe("toBlindLevelInputs", () => {
	it("sends blanks as null, strips a break down to its minutes and drops an empty composition", () => {
		const withBlanks: BlindLevelRow = {
			...level("1", "100", ""),
			ante: "",
			games: [],
		};
		const pause: BlindLevelRow = { ...breakRow("br"), blind1: "5" };
		expect(toBlindLevelInputs([withBlanks, pause])).toEqual([
			{
				ante: null,
				blind1: 100,
				blind2: null,
				blind3: null,
				games: null,
				isBreak: false,
				minutes: 20,
			},
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				games: null,
				isBreak: true,
				minutes: 10,
			},
		]);
	});
});

describe("toBlindLevelRows", () => {
	it("orders the server levels by number and keeps their ids as row keys", () => {
		const rows = toBlindLevelRows([
			{
				ante: 200,
				blind1: 100,
				blind2: 200,
				blind3: null,
				games: [{ blind1: 100, variants: ["Razz"] }],
				id: "lv2",
				isBreak: false,
				level: 2,
				minutes: 20,
			},
			{
				ante: null,
				blind1: null,
				blind2: null,
				blind3: null,
				id: "lv1",
				isBreak: true,
				level: 1,
				minutes: 10,
			},
		]);
		expect(rows.map((row) => row.uid)).toEqual(["lv1", "lv2"]);
		expect(rows[1]).toMatchObject({
			ante: "200",
			blind3: "",
			games: [
				{
					ante: null,
					blind1: 100,
					blind2: null,
					blind3: null,
					name: null,
					variants: ["Razz"],
				},
			],
		});
	});
});

describe("labelBlindRows / summarizeBlindRows", () => {
	const rows = [
		level("1", "100", "200", "20"),
		breakRow("br"),
		level("2", "200", "400", "25"),
	];

	it("numbers only the levels, so a break never shifts the level numbers", () => {
		expect(labelBlindRows(rows).map((row) => row.label)).toEqual([
			"L1",
			"BR",
			"L2",
		]);
	});

	it("counts levels without breaks but includes break minutes in the total", () => {
		expect(summarizeBlindRows(rows)).toEqual({
			levelCount: 2,
			totalMinutes: 55,
		});
	});

	it("defaults new levels to the last level's length, or 20 minutes", () => {
		expect(defaultLevelMinutes(rows)).toBe("25");
		expect(defaultLevelMinutes([breakRow("br")])).toBe("20");
	});
});

describe("sameBlindStructure / hasBlindRowErrors", () => {
	it("compares what would be saved, not the row keys", () => {
		const rows = [level("1", "100", "200")];
		expect(sameBlindStructure(rows, [level("other", "100", "200")])).toBe(true);
		expect(sameBlindStructure(rows, [level("1", "100", "300")])).toBe(false);
	});

	it("flags a non-integer amount but ignores blind cells on a break", () => {
		expect(hasBlindRowErrors([level("1", "100.5", "200")])).toBe(true);
		expect(hasBlindRowErrors([{ ...breakRow("br"), blind1: "x" }])).toBe(false);
		expect(hasBlindRowErrors([{ ...breakRow("br"), minutes: "-1" }])).toBe(
			true
		);
	});
});
