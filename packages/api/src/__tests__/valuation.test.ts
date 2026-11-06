import { describe, expect, it } from "vitest";
import {
	type ValuationAsset,
	type ValuationLine,
	type ValuationRate,
	valueEntries,
} from "../services/valuation";

const T0 = Date.parse("2026-09-01T00:00:00.000Z");

function at(seconds: number): Date {
	return new Date(T0 + seconds * 1000);
}

function line(
	entryId: string,
	assetId: string,
	quantity: number,
	options: { effect?: "real" | "virtual"; second?: number } = {}
): ValuationLine {
	return {
		assetId,
		effect: options.effect ?? "real",
		entryId,
		occurredAt: at(options.second ?? 0),
		quantity,
	};
}

function rate(
	id: string,
	baseAssetId: string,
	quoteAssetId: string,
	rateNum: number,
	rateDen: number,
	effectiveFrom: Date
): ValuationRate {
	return { baseAssetId, effectiveFrom, id, quoteAssetId, rateDen, rateNum };
}

const assets: ValuationAsset[] = [
	{ id: "pt", kind: "currency" },
	{ id: "jpy", kind: "currency" },
	{ id: "usd", kind: "currency" },
	{ id: "main-ticket", kind: "item" },
];

it("rejects conversion overflow rather than returning rounded money", () => {
	const input = {
		assets,
		baseAssetId: "pt",
		lines: [line("e", "usd", 4_503_599_627_370_495)],
		rates: [rate("usd-pt", "usd", "pt", 2, 1, new Date(0))],
	};
	expect(valueEntries(input).entries.get("e")?.real?.profitLoss).toBe(
		9_007_199_254_740_990
	);
	expect(() =>
		valueEntries({
			...input,
			lines: [line("e", "usd", 4_503_599_627_370_496)],
		})
	).toThrow("Integer total exceeds the safe integer range");
});

describe("valueEntries: the section 12.1 example (base pt, 1 Main ticket = 20,000 pt)", () => {
	const result = valueEntries({
		assets,
		baseAssetId: "pt",
		lines: [
			line("satellite", "pt", -3000),
			line("satellite", "main-ticket", 1),
			line("main", "main-ticket", -1),
			line("main", "pt", 45_000),
			line("freeroll", "pt", -5000, { effect: "virtual" }),
			line("freeroll", "pt", 8000),
		],
		rates: [rate("ticket-pt", "main-ticket", "pt", 20_000, 1, new Date(0))],
	});

	it("values each entry's real and virtual P/L and BI", () => {
		expect(result.entries.get("satellite")).toMatchObject({
			real: { buyIn: 3000, profitLoss: -3000 },
			virtual: { buyIn: 3000, profitLoss: 17_000 },
		});
		expect(result.entries.get("main")).toMatchObject({
			real: { buyIn: 0, profitLoss: 45_000 },
			virtual: { buyIn: 20_000, profitLoss: 25_000 },
		});
		expect(result.entries.get("freeroll")).toMatchObject({
			real: { buyIn: 0, profitLoss: 8000 },
			virtual: { buyIn: 5000, profitLoss: 3000 },
		});
	});
});

describe("valueEntries: conversion paths", () => {
	it("inverts a rate registered from the base currency to the asset", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("e", "usd", -100), line("e", "usd", 250)],
			rates: [rate("jpy-usd", "jpy", "usd", 1, 150, new Date(0))],
		});
		expect(result.entries.get("e")?.real).toEqual({
			buyIn: 15_000,
			cashOut: 37_500,
			profitLoss: 22_500,
		});
	});

	it("converts an item through a currency in two steps", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("e", "jpy", -10_000), line("e", "main-ticket", 1)],
			rates: [
				rate("ticket-usd", "main-ticket", "usd", 200, 1, new Date(0)),
				rate("jpy-usd", "jpy", "usd", 1, 150, new Date(0)),
			],
		});
		expect(result.entries.get("e")).toEqual({
			missingRates: { real: [], virtual: [] },
			real: { buyIn: 10_000, cashOut: 0, profitLoss: -10_000 },
			virtual: { buyIn: 10_000, cashOut: 30_000, profitLoss: 20_000 },
		});
	});

	it("does not route a currency through another currency", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("e", "pt", 1000)],
			rates: [
				rate("pt-usd", "pt", "usd", 1, 100, new Date(0)),
				rate("usd-jpy", "usd", "jpy", 150, 1, new Date(0)),
			],
		});
		expect(result.entries.get("e")?.real).toBeNull();
		expect(result.entries.get("e")?.missingRates.real).toEqual([
			{ assetId: "pt", earliestOccurredAt: at(0) },
		]);
	});
});

describe("valueEntries: missing rates", () => {
	it("excludes an entry with an unconvertible line instead of counting it as 0", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [
				line("ok", "jpy", 5000),
				line("no-rate", "jpy", -1000),
				line("no-rate", "usd", 50, { second: 30 }),
				line("no-rate", "usd", 70, { second: 10 }),
			],
			rates: [],
		});
		expect(result.entries.get("no-rate")).toEqual({
			missingRates: {
				real: [{ assetId: "usd", earliestOccurredAt: at(10) }],
				virtual: [{ assetId: "usd", earliestOccurredAt: at(10) }],
			},
			real: null,
			virtual: null,
		});
	});

	it("does not apply the first rate to a line older than it", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("old", "usd", 10, { second: 59 })],
			rates: [rate("usd-jpy", "usd", "jpy", 150, 1, at(60))],
		});
		expect(result.entries.get("old")?.real).toBeNull();
		expect(result.entries.get("old")?.missingRates.real).toEqual([
			{ assetId: "usd", earliestOccurredAt: at(59) },
		]);
	});

	it("excludes an entry whose item has no rate only from virtual amounts", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "pt",
			lines: [line("e", "pt", -3000), line("e", "main-ticket", 1)],
			rates: [],
		});
		expect(result.entries.get("e")).toEqual({
			missingRates: {
				real: [],
				virtual: [{ assetId: "main-ticket", earliestOccurredAt: at(0) }],
			},
			real: { buyIn: 3000, cashOut: 0, profitLoss: -3000 },
			virtual: null,
		});
	});
});

describe("valueEntries: effective time", () => {
	it("applies a row with effective_from = 0 to lines before it was registered", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [
				{
					assetId: "usd",
					effect: "real",
					entryId: "e",
					occurredAt: new Date("2015-01-01T00:00:00.000Z"),
					quantity: 10,
				},
			],
			rates: [rate("usd-jpy", "usd", "jpy", 150, 1, new Date(0))],
		});
		expect(result.entries.get("e")?.real?.profitLoss).toBe(1500);
	});

	it("switches to a new rate at the same second as its effective_from", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [
				line("before", "usd", 10, { second: 59 }),
				line("same-second", "usd", 10, { second: 60 }),
			],
			rates: [
				rate("old", "usd", "jpy", 150, 1, new Date(0)),
				rate("new", "usd", "jpy", 160, 1, at(60)),
			],
		});
		expect(result.entries.get("before")?.real?.profitLoss).toBe(1500);
		expect(result.entries.get("same-second")?.real?.profitLoss).toBe(1600);
	});
});

describe("valueEntries: rounding", () => {
	const halfRate = [rate("pt-jpy", "pt", "jpy", 1, 2, new Date(0))];

	it("rounds 0.5 and -0.5 away from zero", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("plus", "pt", 1), line("minus", "pt", -1)],
			rates: halfRate,
		});
		expect(result.entries.get("plus")?.real?.profitLoss).toBe(1);
		expect(result.entries.get("minus")?.real).toEqual({
			buyIn: 1,
			cashOut: 0,
			profitLoss: -1,
		});
	});

	it("rounds once per asset and rate after summing the quantities", () => {
		const result = valueEntries({
			assets,
			baseAssetId: "jpy",
			lines: [line("e", "pt", 1), line("e", "pt", 1, { second: 5 })],
			rates: halfRate,
		});
		expect(result.entries.get("e")?.real?.profitLoss).toBe(1);
	});
});
