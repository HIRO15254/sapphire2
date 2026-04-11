import { describe, expect, it } from "vitest";
import {
	computeBreakMinutesFromEvents,
	computeCashGamePLFromEvents,
	computeTimestampsFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";

describe("computeTimestampsFromEvents", () => {
	it("returns startedAt from a single session_start event and endedAt as null", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const events = [{ eventType: "session_start", occurredAt: start }];
		const result = computeTimestampsFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.endedAt).toBeNull();
	});

	it("returns both startedAt and endedAt when session_start and session_end are present", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const end = new Date("2024-01-01T12:00:00Z");
		const events = [
			{ eventType: "session_start", occurredAt: start },
			{ eventType: "session_end", occurredAt: end },
		];
		const result = computeTimestampsFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.endedAt).toEqual(end);
	});

	it("uses the first session_start and last session_end across multiple pairs", () => {
		const firstStart = new Date("2024-01-01T10:00:00Z");
		const firstEnd = new Date("2024-01-01T11:00:00Z");
		const secondStart = new Date("2024-01-01T11:30:00Z");
		const secondEnd = new Date("2024-01-01T13:00:00Z");
		const events = [
			{ eventType: "session_start", occurredAt: firstStart },
			{ eventType: "session_end", occurredAt: firstEnd },
			{ eventType: "session_start", occurredAt: secondStart },
			{ eventType: "session_end", occurredAt: secondEnd },
		];
		const result = computeTimestampsFromEvents(events);
		expect(result.startedAt).toEqual(firstStart);
		expect(result.endedAt).toEqual(secondEnd);
	});

	it("returns both null when events array is empty", () => {
		const result = computeTimestampsFromEvents([]);
		expect(result.startedAt).toBeNull();
		expect(result.endedAt).toBeNull();
	});

	it("returns both null when events contain no lifecycle events", () => {
		const events = [
			{
				eventType: "chip_add",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
		];
		const result = computeTimestampsFromEvents(events);
		expect(result.startedAt).toBeNull();
		expect(result.endedAt).toBeNull();
	});
});

describe("computeCashGamePLFromEvents", () => {
	it("returns correct totalBuyIn and null cashOut for a single chip_add", () => {
		const events = [
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 200 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(200);
		expect(result.addonTotal).toBe(0);
		expect(result.cashOut).toBeNull();
		expect(result.profitLoss).toBeNull();
		expect(result.evCashOut).toBeNull();
	});

	it("computes correct buyIn and cashOut from chip_add followed by stack_record", () => {
		const events = [
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 200 }),
			},
			{
				eventType: "stack_record",
				payload: JSON.stringify({ stackAmount: 350, allIns: [] }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(200);
		expect(result.addonTotal).toBe(0);
		expect(result.cashOut).toBe(350);
		expect(result.profitLoss).toBe(150);
		expect(result.evCashOut).toBe(350);
	});

	it("computes addonTotal as sum of all chip_adds except the first", () => {
		const events = [
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 200 }),
			},
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 100 }),
			},
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 50 }),
			},
			{
				eventType: "stack_record",
				payload: JSON.stringify({ stackAmount: 500, allIns: [] }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(350);
		expect(result.addonTotal).toBe(150);
		expect(result.cashOut).toBe(500);
		expect(result.profitLoss).toBe(150);
	});

	it("computes evCashOut correctly using allIn equity data", () => {
		// EV diff = potSize * (equity / 100) * trials - potSize * wins
		// potSize=400, equity=75, trials=1, wins=0 => 400 * 0.75 * 1 - 400 * 0 = 300
		const allIn = { potSize: 400, equity: 75, trials: 1, wins: 0 };
		const events = [
			{
				eventType: "chip_add",
				payload: JSON.stringify({ amount: 200 }),
			},
			{
				eventType: "stack_record",
				payload: JSON.stringify({ stackAmount: 0, allIns: [allIn] }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.cashOut).toBe(0);
		expect(result.profitLoss).toBe(-200);
		// evCashOut = 0 + 300 = 300
		expect(result.evCashOut).toBe(300);
	});

	it("returns zeroed totals and null cashOut for empty events", () => {
		const result = computeCashGamePLFromEvents([]);
		expect(result.totalBuyIn).toBe(0);
		expect(result.addonTotal).toBe(0);
		expect(result.cashOut).toBeNull();
		expect(result.profitLoss).toBeNull();
		expect(result.evCashOut).toBeNull();
	});
});

describe("computeTournamentPLFromEvents", () => {
	it("counts rebuys and addons from chipPurchases by name", () => {
		const stackRecord = {
			stackAmount: 10_000,
			chipPurchases: [
				{ name: "Rebuy", cost: 100, chips: 10_000 },
				{ name: "Add-on", cost: 50, chips: 5000 },
			],
		};
		const events = [
			{
				eventType: "tournament_stack_record",
				payload: JSON.stringify(stackRecord),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		expect(result.rebuyCount).toBe(1);
		expect(result.rebuyCost).toBe(100);
		expect(result.addonCount).toBe(1);
		expect(result.addonCost).toBe(50);
		expect(result.profitLoss).toBeNull();
	});

	it("extracts placement, totalEntries, prizeMoney, and bountyPrizes from tournament_result", () => {
		const resultPayload = {
			placement: 3,
			totalEntries: 50,
			prizeMoney: 500,
			bountyPrizes: 75,
		};
		const events = [
			{
				eventType: "tournament_result",
				payload: JSON.stringify(resultPayload),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		expect(result.placement).toBe(3);
		expect(result.totalEntries).toBe(50);
		expect(result.prizeMoney).toBe(500);
		expect(result.bountyPrizes).toBe(75);
	});

	it("returns null profitLoss when there is no tournament_result event", () => {
		const stackRecord = {
			stackAmount: 10_000,
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
		};
		const events = [
			{
				eventType: "tournament_stack_record",
				payload: JSON.stringify(stackRecord),
			},
		];
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.profitLoss).toBeNull();
	});

	it("falls back to legacy rebuy/addon fields when chipPurchases is empty", () => {
		const stackRecord = {
			stackAmount: 8000,
			chipPurchases: [],
			rebuy: { cost: 100, chips: 10_000 },
			addon: { cost: 50, chips: 5000 },
		};
		const events = [
			{
				eventType: "tournament_stack_record",
				payload: JSON.stringify(stackRecord),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		expect(result.rebuyCount).toBe(1);
		expect(result.rebuyCost).toBe(100);
		expect(result.addonCount).toBe(1);
		expect(result.addonCost).toBe(50);
	});

	it("computes profitLoss correctly using tournamentBuyIn, entryFee, rebuyCost, and addonCost", () => {
		const stackRecord = {
			stackAmount: 10_000,
			chipPurchases: [
				{ name: "Rebuy", cost: 100, chips: 10_000 },
				{ name: "Add-on", cost: 50, chips: 5000 },
			],
		};
		const resultPayload = {
			placement: 1,
			totalEntries: 30,
			prizeMoney: 1000,
			bountyPrizes: 200,
		};
		const events = [
			{
				eventType: "tournament_stack_record",
				payload: JSON.stringify(stackRecord),
			},
			{
				eventType: "tournament_result",
				payload: JSON.stringify(resultPayload),
			},
		];
		// profitLoss = (1000 + 200) - (200 + 20 + 100 + 50) = 1200 - 370 = 830
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.profitLoss).toBe(830);
	});
});

describe("computeBreakMinutesFromEvents", () => {
	it("returns 0 when there is only a session_start with no session_end", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
		];
		expect(computeBreakMinutesFromEvents(events)).toBe(0);
	});

	it("returns correct break minutes for a single break between two sessions", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "session_end",
				occurredAt: new Date("2024-01-01T11:00:00Z"),
			},
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T11:30:00Z"),
			},
		];
		// break = 30 minutes
		expect(computeBreakMinutesFromEvents(events)).toBe(30);
	});

	it("sums break minutes across multiple breaks", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "session_end",
				occurredAt: new Date("2024-01-01T11:00:00Z"),
			},
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T11:15:00Z"),
			},
			{
				eventType: "session_end",
				occurredAt: new Date("2024-01-01T12:00:00Z"),
			},
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T12:45:00Z"),
			},
		];
		// first break = 15 min, second break = 45 min, total = 60
		expect(computeBreakMinutesFromEvents(events)).toBe(60);
	});

	it("returns 0 when there is no session_end event", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "chip_add",
				occurredAt: new Date("2024-01-01T10:05:00Z"),
			},
		];
		expect(computeBreakMinutesFromEvents(events)).toBe(0);
	});
});
