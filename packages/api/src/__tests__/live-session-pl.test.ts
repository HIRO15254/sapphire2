import { describe, expect, it } from "vitest";
import {
	computeCashGamePLFromEvents,
	computeCashGameSummaryFromEvents,
	computeHeroSeatPositionFromEvents,
	computeSeatedPlayersFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";

function cashEvent(eventType: string, payload: Record<string, unknown>) {
	return { eventType, payload: JSON.stringify(payload) };
}

describe("computeCashGameSummaryFromEvents", () => {
	it("seeds the current stack from the buy-in the session started with", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
		]);
		expect(summary.currentStack).toBe(30_000);
		expect(summary.totalBuyIn).toBe(30_000);
	});

	it("keeps a freshly started session at break-even instead of unknown", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
		]);
		expect((summary.currentStack ?? 0) - summary.totalBuyIn).toBe(0);
	});

	it("moves the stack with chips brought to or taken off the table", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("chips_add_remove", { amount: 10_000 }),
			cashEvent("chips_add_remove", { amount: -4000 }),
		]);
		expect(summary.currentStack).toBe(36_000);
		expect(summary.totalBuyIn).toBe(40_000);
		expect(summary.addonCount).toBe(1);
	});

	it("keeps the result unchanged when chips are only added to the table", () => {
		const before = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("update_stack", { stackAmount: 50_000 }),
		]);
		const after = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("update_stack", { stackAmount: 50_000 }),
			cashEvent("chips_add_remove", { amount: 10_000 }),
		]);
		expect((before.currentStack ?? 0) - before.totalBuyIn).toBe(20_000);
		expect((after.currentStack ?? 0) - after.totalBuyIn).toBe(20_000);
	});

	it("lets a recorded stack replace the derived one", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("chips_add_remove", { amount: 10_000 }),
			cashEvent("update_stack", { stackAmount: 51_800 }),
		]);
		expect(summary.currentStack).toBe(51_800);
	});

	it("tracks max and min from recorded stacks only", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("update_stack", { stackAmount: 51_800 }),
			cashEvent("update_stack", { stackAmount: 42_000 }),
		]);
		expect(summary.maxStack).toBe(51_800);
		expect(summary.minStack).toBe(42_000);
	});

	it("reads the cash-out from the closing event", () => {
		const summary = computeCashGameSummaryFromEvents([
			cashEvent("session_start", { buyInAmount: 30_000 }),
			cashEvent("session_end", { cashOutAmount: 44_000 }),
		]);
		expect(summary.cashOut).toBe(44_000);
	});
});

describe("computeSeatedPlayersFromEvents", () => {
	const at = (iso: string) => new Date(iso);
	const joinEvent = (occurredAt: string, payload: Record<string, unknown>) => ({
		eventType: "player_join",
		occurredAt: at(occurredAt),
		payload: JSON.stringify(payload),
	});
	const leaveEvent = (
		occurredAt: string,
		payload: Record<string, unknown>
	) => ({
		eventType: "player_leave",
		occurredAt: at(occurredAt),
		payload: JSON.stringify(payload),
	});

	it("returns an empty array when there are no events", () => {
		expect(computeSeatedPlayersFromEvents([])).toEqual([]);
	});

	it("returns an empty array when no events touch players", () => {
		const events = [
			{
				eventType: "update_stack",
				occurredAt: at("2026-01-01T10:00:00Z"),
				payload: JSON.stringify({ stackAmount: 100 }),
			},
		];
		expect(computeSeatedPlayersFromEvents(events)).toEqual([]);
	});

	it("marks a player active from a single player_join, seatPosition null when absent", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1" }),
		]);
		expect(result).toEqual([
			{
				playerId: "p1",
				seatPosition: null,
				isActive: true,
				joinedAt: at("2026-01-01T10:00:00Z"),
				leftAt: null,
				stints: [
					{
						joinedAt: at("2026-01-01T10:00:00Z"),
						leftAt: null,
						seatPosition: null,
					},
				],
			},
		]);
	});

	it("carries the seatPosition from the player_join payload", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 4 }),
		]);
		expect(result[0]?.seatPosition).toBe(4);
	});

	it("carries seatPosition 0 (boundary) without coercing to null", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 0 }),
		]);
		expect(result[0]?.seatPosition).toBe(0);
	});

	it("marks a player inactive after player_leave, retaining seat and joinedAt", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 2 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
		]);
		expect(result).toEqual([
			{
				playerId: "p1",
				seatPosition: 2,
				isActive: false,
				joinedAt: at("2026-01-01T10:00:00Z"),
				leftAt: at("2026-01-01T11:00:00Z"),
				stints: [
					{
						joinedAt: at("2026-01-01T10:00:00Z"),
						leftAt: at("2026-01-01T11:00:00Z"),
						seatPosition: 2,
					},
				],
			},
		]);
	});

	it("ignores a player_leave with no preceding player_join", () => {
		const result = computeSeatedPlayersFromEvents([
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "ghost" }),
		]);
		expect(result).toEqual([]);
	});

	it("reflects the latest stint as the current state on re-join after leaving", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 2 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			joinEvent("2026-01-01T12:00:00Z", { playerId: "p1", seatPosition: 7 }),
		]);
		expect(result[0]).toMatchObject({
			playerId: "p1",
			seatPosition: 7,
			isActive: true,
			joinedAt: at("2026-01-01T12:00:00Z"),
			leftAt: null,
		});
	});

	it("keeps one entry per player but preserves every in/out stint", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 2 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			joinEvent("2026-01-01T12:00:00Z", { playerId: "p1", seatPosition: 7 }),
			leaveEvent("2026-01-01T13:00:00Z", { playerId: "p1" }),
		]);
		expect(result).toHaveLength(1);
		expect(result[0]?.stints).toEqual([
			{
				joinedAt: at("2026-01-01T10:00:00Z"),
				leftAt: at("2026-01-01T11:00:00Z"),
				seatPosition: 2,
			},
			{
				joinedAt: at("2026-01-01T12:00:00Z"),
				leftAt: at("2026-01-01T13:00:00Z"),
				seatPosition: 7,
			},
		]);
	});

	it("treats the most recent stint as current — inactive after a final leave", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 2 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			joinEvent("2026-01-01T12:00:00Z", { playerId: "p1", seatPosition: 7 }),
			leaveEvent("2026-01-01T13:00:00Z", { playerId: "p1" }),
		]);
		expect(result[0]).toMatchObject({
			isActive: false,
			seatPosition: 7,
			joinedAt: at("2026-01-01T12:00:00Z"),
			leftAt: at("2026-01-01T13:00:00Z"),
		});
	});

	it("leaves an open stint open when only the first of two stints was closed", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 1 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			joinEvent("2026-01-01T12:00:00Z", { playerId: "p1", seatPosition: 3 }),
		]);
		expect(result[0]?.stints).toEqual([
			{
				joinedAt: at("2026-01-01T10:00:00Z"),
				leftAt: at("2026-01-01T11:00:00Z"),
				seatPosition: 1,
			},
			{
				joinedAt: at("2026-01-01T12:00:00Z"),
				leftAt: null,
				seatPosition: 3,
			},
		]);
	});

	it("closes the latest open stint, not an already-closed earlier one", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1" }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			joinEvent("2026-01-01T12:00:00Z", { playerId: "p1" }),
			leaveEvent("2026-01-01T13:00:00Z", { playerId: "p1" }),
		]);
		expect(result[0]?.stints[0]?.leftAt).toEqual(at("2026-01-01T11:00:00Z"));
		expect(result[0]?.stints[1]?.leftAt).toEqual(at("2026-01-01T13:00:00Z"));
	});

	it("ignores a redundant player_leave when the player has already left", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1" }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
			leaveEvent("2026-01-01T12:00:00Z", { playerId: "p1" }),
		]);
		expect(result[0]?.stints).toHaveLength(1);
		expect(result[0]?.stints[0]?.leftAt).toEqual(at("2026-01-01T11:00:00Z"));
	});

	it("ignores hero events that carry no playerId", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { isHero: true, seatPosition: 3 }),
			leaveEvent("2026-01-01T11:00:00Z", { isHero: true }),
		]);
		expect(result).toEqual([]);
	});

	it("tracks multiple players independently", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { playerId: "p1", seatPosition: 1 }),
			joinEvent("2026-01-01T10:05:00Z", { playerId: "p2", seatPosition: 2 }),
			leaveEvent("2026-01-01T11:00:00Z", { playerId: "p1" }),
		]);
		expect(result).toHaveLength(2);
		expect(result.find((s) => s.playerId === "p1")?.isActive).toBe(false);
		expect(result.find((s) => s.playerId === "p2")?.isActive).toBe(true);
	});

	it("skips a player_join whose payload has no playerId and no hero flag", () => {
		const result = computeSeatedPlayersFromEvents([
			joinEvent("2026-01-01T10:00:00Z", { seatPosition: 1 }),
		]);
		expect(result).toEqual([]);
	});
});

describe("computeHeroSeatPositionFromEvents", () => {
	const ev = (eventType: string, payload: Record<string, unknown>) => ({
		eventType,
		payload: JSON.stringify(payload),
	});

	it("returns null when there are no events", () => {
		expect(computeHeroSeatPositionFromEvents([])).toBeNull();
	});

	it("returns null when the hero never joined", () => {
		const events = [ev("player_join", { playerId: "p1", seatPosition: 3 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
	});

	it("returns the hero seat from a hero player_join", () => {
		const events = [ev("player_join", { isHero: true, seatPosition: 6 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBe(6);
	});

	it("returns null after the hero leaves", () => {
		const events = [
			ev("player_join", { isHero: true, seatPosition: 6 }),
			ev("player_leave", { isHero: true }),
		];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
	});

	it("reflects the latest hero seat after a leave and re-join", () => {
		const events = [
			ev("player_join", { isHero: true, seatPosition: 6 }),
			ev("player_leave", { isHero: true }),
			ev("player_join", { isHero: true, seatPosition: 1 }),
		];
		expect(computeHeroSeatPositionFromEvents(events)).toBe(1);
	});

	it("ignores non-hero player events", () => {
		const events = [ev("player_join", { playerId: "p1", seatPosition: 8 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
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

	it("exposes chipRemoveTotal from negative chips_add_remove events (SA2-124)", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 500 }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: -300, type: "remove" }),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 400 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.chipRemoveTotal).toBe(300);
		expect(result.totalBuyIn).toBe(500);
		expect(result.profitLoss).toBe(200);
	});

	it("reports chipRemoveTotal as 0 when there are no chip removals", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 500 }),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 400 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.chipRemoveTotal).toBe(0);
		expect(result.profitLoss).toBe(-100);
	});

	it("accumulates chipRemoveTotal across multiple removals without touching addonTotal", () => {
		const events = [
			{
				eventType: "session_start",
				payload: JSON.stringify({ buyInAmount: 1000 }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: -200, type: "remove" }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: 300, type: "add" }),
			},
			{
				eventType: "chips_add_remove",
				payload: JSON.stringify({ amount: -100, type: "remove" }),
			},
			{
				eventType: "session_end",
				payload: JSON.stringify({ cashOutAmount: 900 }),
			},
		];
		const result = computeCashGamePLFromEvents(events);
		expect(result.chipRemoveTotal).toBe(300);
		expect(result.addonTotal).toBe(300);
		expect(result.totalBuyIn).toBe(1300);
		expect(result.profitLoss).toBe(-100);
	});

	it("computes evCashOut correctly using all_in events", () => {
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
		expect(result.evCashOut).toBe(300);
	});

	it("computes evCashOut correctly with multiple trials", () => {
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
	it("counts chip purchases per sessionChipPurchaseId from purchase_chips events", () => {
		const events = [
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					sessionChipPurchaseId: "scp-1",
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					sessionChipPurchaseId: "scp-1",
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					sessionChipPurchaseId: "scp-2",
					name: "Add-on",
					cost: 50,
					chips: 5000,
				}),
			},
		];
		const result = computeTournamentPLFromEvents(events);
		expect(result.chipPurchaseCounts.get("scp-1")).toBe(2);
		expect(result.chipPurchaseCounts.get("scp-2")).toBe(1);
		expect(result.chipPurchaseCost).toBe(250);
		expect(result.profitLoss).toBeNull();
	});

	it("returns empty chipPurchaseCounts when there are no purchase_chips events", () => {
		const result = computeTournamentPLFromEvents([]);
		expect(result.chipPurchaseCounts.size).toBe(0);
		expect(result.chipPurchaseCost).toBe(0);
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
					sessionChipPurchaseId: "scp-1",
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
		expect(result.beforeDeadline).toBe(true);
		expect(result.placement).toBeNull();
		expect(result.totalEntries).toBeNull();
		expect(result.prizeMoney).toBe(0);
		expect(result.bountyPrizes).toBe(0);
		expect(result.profitLoss).toBe(-220);
	});

	it("computes profitLoss correctly using tournamentBuyIn, entryFee, and purchase_chips costs", () => {
		const events = [
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					sessionChipPurchaseId: "scp-1",
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				}),
			},
			{
				eventType: "purchase_chips",
				payload: JSON.stringify({
					sessionChipPurchaseId: "scp-2",
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
		const result = computeTournamentPLFromEvents(events, 200, 20);
		expect(result.profitLoss).toBe(830);
	});
});
