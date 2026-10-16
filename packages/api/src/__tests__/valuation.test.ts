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
		entryId,
		assetId,
		quantity,
		effect: options.effect ?? "real",
		occurredAt: at(options.second ?? 0),
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
	return { id, baseAssetId, quoteAssetId, rateNum, rateDen, effectiveFrom };
}

const assets: ValuationAsset[] = [
	{ id: "pt", kind: "currency" },
	{ id: "jpy", kind: "currency" },
	{ id: "usd", kind: "currency" },
	{ id: "main-ticket", kind: "item" },
];

describe("valueEntries: the section 12.1 example (base pt, 1 Main ticket = 20,000 pt)", () => {
	const result = valueEntries({
		baseAssetId: "pt",
		assets,
		rates: [rate("ticket-pt", "main-ticket", "pt", 20_000, 1, new Date(0))],
		lines: [
			line("satellite", "pt", -3000),
			line("satellite", "main-ticket", 1),
			line("main", "main-ticket", -1),
			line("main", "pt", 45_000),
			line("freeroll", "pt", -5000, { effect: "virtual" }),
			line("freeroll", "pt", 8000),
		],
	});

	it("values each entry's real and virtual P/L and BI", () => {
		expect(result.entries.get("satellite")).toMatchObject({
			real: { profitLoss: -3000, buyIn: 3000 },
			virtual: { profitLoss: 17_000, buyIn: 3000 },
		});
		expect(result.entries.get("main")).toMatchObject({
			real: { profitLoss: 45_000, buyIn: 0 },
			virtual: { profitLoss: 25_000, buyIn: 20_000 },
		});
		expect(result.entries.get("freeroll")).toMatchObject({
			real: { profitLoss: 8000, buyIn: 0 },
			virtual: { profitLoss: 3000, buyIn: 5000 },
		});
	});

	it("takes ROI as the ratio of the totals", () => {
		expect(result.real).toMatchObject({ profitLoss: 50_000, buyIn: 3000 });
		expect(Math.round(result.real.roi ?? 0)).toBe(1667);
		expect(result.virtual).toMatchObject({
			profitLoss: 45_000,
			buyIn: 28_000,
			cashOut: 73_000,
		});
		expect(Math.round(result.virtual.roi ?? 0)).toBe(161);
		expect(result.real.excludedEntryCount).toBe(0);
		expect(result.virtual.excludedEntryCount).toBe(0);
	});
});

describe("valueEntries: conversion paths", () => {
	it("inverts a rate registered from the base currency to the asset", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [rate("jpy-usd", "jpy", "usd", 1, 150, new Date(0))],
			lines: [line("e", "usd", -100), line("e", "usd", 250)],
		});
		expect(result.entries.get("e")?.real).toEqual({
			profitLoss: 22_500,
			buyIn: 15_000,
			cashOut: 37_500,
		});
	});

	it("converts an item through a currency in two steps", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [
				rate("ticket-usd", "main-ticket", "usd", 200, 1, new Date(0)),
				rate("jpy-usd", "jpy", "usd", 1, 150, new Date(0)),
			],
			lines: [line("e", "jpy", -10_000), line("e", "main-ticket", 1)],
		});
		expect(result.entries.get("e")).toEqual({
			real: { profitLoss: -10_000, buyIn: 10_000, cashOut: 0 },
			virtual: { profitLoss: 20_000, buyIn: 10_000, cashOut: 30_000 },
		});
	});

	it("does not route a currency through another currency", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [
				rate("pt-usd", "pt", "usd", 1, 100, new Date(0)),
				rate("usd-jpy", "usd", "jpy", 150, 1, new Date(0)),
			],
			lines: [line("e", "pt", 1000)],
		});
		expect(result.entries.get("e")?.real).toBeNull();
		expect(result.real.missingRates).toEqual([
			{ assetId: "pt", earliestOccurredAt: at(0) },
		]);
	});
});

describe("valueEntries: missing rates", () => {
	it("excludes an entry with an unconvertible line instead of counting it as 0", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [],
			lines: [
				line("ok", "jpy", 5000),
				line("no-rate", "jpy", -1000),
				line("no-rate", "usd", 50, { second: 30 }),
				line("no-rate", "usd", 70, { second: 10 }),
			],
		});
		expect(result.entries.get("no-rate")).toEqual({
			real: null,
			virtual: null,
		});
		expect(result.real).toMatchObject({
			profitLoss: 5000,
			buyIn: 0,
			roi: null,
			excludedEntryCount: 1,
			missingRates: [{ assetId: "usd", earliestOccurredAt: at(10) }],
		});
		expect(result.virtual.excludedEntryCount).toBe(1);
	});

	it("does not apply the first rate to a line older than it", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [rate("usd-jpy", "usd", "jpy", 150, 1, at(60))],
			lines: [line("old", "usd", 10, { second: 59 })],
		});
		expect(result.entries.get("old")?.real).toBeNull();
		expect(result.real.missingRates).toEqual([
			{ assetId: "usd", earliestOccurredAt: at(59) },
		]);
	});

	it("excludes an entry whose item has no rate only from virtual amounts", () => {
		const result = valueEntries({
			baseAssetId: "pt",
			assets,
			rates: [],
			lines: [line("e", "pt", -3000), line("e", "main-ticket", 1)],
		});
		expect(result.entries.get("e")).toEqual({
			real: { profitLoss: -3000, buyIn: 3000, cashOut: 0 },
			virtual: null,
		});
		expect(result.real.excludedEntryCount).toBe(0);
		expect(result.virtual).toMatchObject({
			excludedEntryCount: 1,
			missingRates: [{ assetId: "main-ticket", earliestOccurredAt: at(0) }],
		});
	});
});

describe("valueEntries: effective time", () => {
	it("applies a row with effective_from = 0 to lines before it was registered", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [rate("usd-jpy", "usd", "jpy", 150, 1, new Date(0))],
			lines: [
				{
					entryId: "e",
					assetId: "usd",
					quantity: 10,
					effect: "real",
					occurredAt: new Date("2015-01-01T00:00:00.000Z"),
				},
			],
		});
		expect(result.entries.get("e")?.real?.profitLoss).toBe(1500);
	});

	it("switches to a new rate at the same second as its effective_from", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: [
				rate("old", "usd", "jpy", 150, 1, new Date(0)),
				rate("new", "usd", "jpy", 160, 1, at(60)),
			],
			lines: [
				line("before", "usd", 10, { second: 59 }),
				line("same-second", "usd", 10, { second: 60 }),
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
			baseAssetId: "jpy",
			assets,
			rates: halfRate,
			lines: [line("plus", "pt", 1), line("minus", "pt", -1)],
		});
		expect(result.entries.get("plus")?.real?.profitLoss).toBe(1);
		expect(result.entries.get("minus")?.real).toEqual({
			profitLoss: -1,
			buyIn: 1,
			cashOut: 0,
		});
	});

	it("rounds once per asset and rate after summing the quantities", () => {
		const result = valueEntries({
			baseAssetId: "jpy",
			assets,
			rates: halfRate,
			lines: [line("e", "pt", 1), line("e", "pt", 1, { second: 5 })],
		});
		expect(result.entries.get("e")?.real?.profitLoss).toBe(1);
	});
});
