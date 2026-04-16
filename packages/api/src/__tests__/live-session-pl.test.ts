import { describe, expect, it } from "vitest";
import {
	computeBreakMinutesFromEvents,
	computeCashGamePLFromEvents,
	computeSessionStateFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";

describe("computeSessionStateFromEvents", () => {
	it("returns startedAt from a single session_start event, endedAt null, status active", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const events = [{ eventType: "session_start", occurredAt: start }];
		const result = computeSessionStateFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.endedAt).toBeNull();
		expect(result.status).toBe("active");
	});

	it("returns status completed and endedAt when session_start and session_end are present", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const end = new Date("2024-01-01T12:00:00Z");
		const events = [
			{ eventType: "session_start", occurredAt: start },
			{ eventType: "session_end", occurredAt: end },
		];
		const result = computeSessionStateFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.endedAt).toEqual(end);
		expect(result.status).toBe("completed");
	});

	it("returns status paused when last state event is session_pause", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const pause = new Date("2024-01-01T11:00:00Z");
		const events = [
			{ eventType: "session_start", occurredAt: start },
			{ eventType: "session_pause", occurredAt: pause },
		];
		const result = computeSessionStateFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.endedAt).toBeNull();
		expect(result.status).toBe("paused");
	});

	it("returns status active after session_resume following session_pause", () => {
		const start = new Date("2024-01-01T10:00:00Z");
		const pause = new Date("2024-01-01T11:00:00Z");
		const resume = new Date("2024-01-01T11:30:00Z");
		const events = [
			{ eventType: "session_start", occurredAt: start },
			{ eventType: "session_pause", occurredAt: pause },
			{ eventType: "session_resume", occurredAt: resume },
		];
		const result = computeSessionStateFromEvents(events);
		expect(result.startedAt).toEqual(start);
		expect(result.status).toBe("active");
	});

	it("returns all null/active when events array is empty", () => {
		const result = computeSessionStateFromEvents([]);
		expect(result.startedAt).toBeNull();
		expect(result.endedAt).toBeNull();
		expect(result.status).toBe("active");
	});

	it("returns all null/active when events contain no lifecycle events", () => {
		const events = [
			{
				eventType: "update_stack",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
		];
		const result = computeSessionStateFromEvents(events);
		expect(result.startedAt).toBeNull();
		expect(result.endedAt).toBeNull();
		expect(result.status).toBe("active");
	});
});

describe("computeCashGamePLFromEvents", () => {
	it("returns correct totalBuyIn from session_start and null cashOut when no session_end", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 200 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(200);
		expect(result.addonTotal).toBe(0);
		expect(result.cashOut).toBeNull();
		expect(result.profitLoss).toBeNull();
		expect(result.evCashOut).toBeNull();
	});

	it("computes correct buyIn and cashOut from session_start and session_end", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 200 }),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 350 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(200);
		expect(result.addonTotal).toBe(0);
		expect(result.cashOut).toBe(350);
		expect(result.profitLoss).toBe(150);
		expect(result.evCashOut).toBe(350);
	});

	it("computes addonTotal from chips_add_remove add events", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 200 }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: 100, type: "add" }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: 50, type: "add" }),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 500 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.totalBuyIn).toBe(350);
		expect(result.addonTotal).toBe(150);
		expect(result.cashOut).toBe(500);
		expect(result.profitLoss).toBe(150);
	});

	it("computes evCashOut correctly using all_in events", () => {
		// EV diff = potSize * (equity / 100) - (potSize / trials) * wins
		// potSize=400, equity=75, trials=1, wins=0 => 400 * 0.75 - (400 / 1) * 0 = 300
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 200 }),
			},
			{
				eventType: "all_in",
				payload: JSON.stringify({
					potSize: 400,
					equity: 75,
					trials: 1,
					wins: 0,
				}),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 0 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.cashOut).toBe(0);
		expect(result.profitLoss).toBe(-200);
		// evCashOut = 0 + 300 = 300
		expect(result.evCashOut).toBe(300);
	});

	it("computes evCashOut correctly with multiple trials", () => {
		// EV diff = potSize * (equity / 100) - (potSize / trials) * wins
		// potSize=600, equity=50, trials=3, wins=2
		// => 600 * 0.50 - (600 / 3) * 2 = 300 - 400 = -100
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 500 }),
			},
			{
				eventType: "all_in",
				payload: JSON.stringify({
					potSize: 600,
					equity: 50,
					trials: 3,
					wins: 2,
				}),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 400 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.cashOut).toBe(400);
		expect(result.profitLoss).toBe(-100);
		// evCashOut = 400 + (-100) = 300
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
	it("counts chip purchases from purchase_chips events", () => {
		const events = [
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					name: "Add-on",
					cost: 50,
					chips: 5000,
				}),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		// All chip purchases are consolidated: rebuyCount = total purchase count
		expect(result.rebuyCount).toBe(2);
		expect(result.rebuyCost).toBe(150);
		expect(result.profitLoss).toBeNull();
	});

	it("extracts placement, totalEntries, prizeMoney, and bountyPrizes from session_end", () => {
		const events = [
			{
				eventType: "session_end",
				payload: JSON.stringify({
					beforeDeadline: false,
					placement: 3,
					totalEntries: 50,
					prizeMoney: 500,
					bountyPrizes: 75,
				}),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		expect(result.placement).toBe(3);
		expect(result.totalEntries).toBe(50);
		expect(result.prizeMoney).toBe(500);
		expect(result.bountyPrizes).toBe(75);
	});

	it("returns null profitLoss when there is no session_end event", () => {
		const events = [
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
		];
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.profitLoss).toBeNull();
	});

	it("handles beforeDeadline=true session_end with no placement", () => {
		const events = [
			{
				eventType: "session_end",
				payload: JSON.stringify({
					beforeDeadline: true,
					prizeMoney: 0,
					bountyPrizes: 0,
				}),
			},
		];
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.placement).toBeNull();
		expect(result.totalEntries).toBeNull();
		expect(result.prizeMoney).toBe(0);
		expect(result.bountyPrizes).toBe(0);
		// beforeDeadline=true → profitLoss is null (not calculable)
		expect(result.profitLoss).toBeNull();
	});

	it("computes profitLoss correctly using tournamentBuyIn, entryFee, and purchase_chips costs", () => {
		const events = [
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					name: "Add-on",
					cost: 50,
					chips: 5000,
				}),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({
					beforeDeadline: false,
					placement: 1,
					totalEntries: 30,
					prizeMoney: 1000,
					bountyPrizes: 200,
				}),
			},
		];
		// profitLoss = (1000 + 200) - (200 + 20 + 100 + 50) = 1200 - 370 = 830
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.profitLoss).toBe(830);
	});
});

describe("computeBreakMinutesFromEvents", () => {
	it("returns 0 when there is only a session_start with no pause", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
		];
		expect(computeBreakMinutesFromEvents(events)).toBe(0);
	});

	it("returns correct break minutes for a single pause/resume pair", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "session_pause",
				occurredAt: new Date("2024-01-01T11:00:00Z"),
			},
			{
				eventType: "session_resume",
				occurredAt: new Date("2024-01-01T11:30:00Z"),
			},
		];
		// break = 30 minutes
		expect(computeBreakMinutesFromEvents(events)).toBe(30);
	});

	it("sums break minutes across multiple pause/resume pairs", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "session_pause",
				occurredAt: new Date("2024-01-01T11:00:00Z"),
			},
			{
				eventType: "session_resume",
				occurredAt: new Date("2024-01-01T11:15:00Z"),
			},
			{
				eventType: "session_pause",
				occurredAt: new Date("2024-01-01T12:00:00Z"),
			},
			{
				eventType: "session_resume",
				occurredAt: new Date("2024-01-01T12:45:00Z"),
			},
		];
		// first break = 15 min, second break = 45 min, total = 60
		expect(computeBreakMinutesFromEvents(events)).toBe(60);
	});

	it("returns 0 when there is no pause event", () => {
		const events = [
			{
				eventType: "session_start",
				occurredAt: new Date("2024-01-01T10:00:00Z"),
			},
			{
				eventType: "update_stack",
				occurredAt: new Date("2024-01-01T10:05:00Z"),
			},
		];
		expect(computeBreakMinutesFromEvents(events)).toBe(0);
	});
});
