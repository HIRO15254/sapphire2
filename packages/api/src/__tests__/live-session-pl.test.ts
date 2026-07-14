import { describe, expect, it, vi } from "vitest";
import {
	computeBreakMinutesFromEvents,
	computeCashGamePLFromEvents,
	computeHeroSeatPositionFromEvents,
	computeSeatedPlayersFromEvents,
	computeSessionStateFromEvents,
	computeTournamentPLFromEvents,
	getSessionResultTypeId,
	recalculateCashGameSession,
	recalculateTournamentSession,
	syncChipPurchaseResults,
} from "../services/live-session-pl";

describe("syncChipPurchaseResults", () => {
	it("upserts all purchases in one atomic batch with D1-safe chunks", async () => {
		const purchases = Array.from({ length: 51 }, (_, i) => ({
			id: `purchase-${i}`,
		}));
		const selectChain = Promise.resolve(purchases) as Promise<
			typeof purchases
		> & { where: () => Promise<typeof purchases> };
		selectChain.where = () => selectChain;
		const values = vi.fn((rows: unknown[]) => ({
			onConflictDoUpdate: vi.fn(() => rows),
		}));
		const batch = vi.fn((statements: unknown[]) =>
			Promise.all(statements as Promise<unknown>[])
		);
		const db = {
			select: () => ({ from: () => selectChain }),
			insert: () => ({ values }),
			batch,
		};
		const counts = new Map([["purchase-1", 3]]);

		await syncChipPurchaseResults(db as never, "session-1", counts);

		expect(values).toHaveBeenCalledTimes(2);
		expect(values.mock.calls[0]?.[0]).toHaveLength(50);
		expect((values.mock.calls[0]?.[0] as { count: number }[])[1]?.count).toBe(
			3
		);
		expect((values.mock.calls[0]?.[0] as { count: number }[])[0]?.count).toBe(
			0
		);
		expect(values.mock.calls[1]?.[0]).toHaveLength(1);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
	});
});

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
		// buyIn 500, chip removal 300, cashOut 400 =>
		// profitLoss = 400 + 300 - 500 = 200, and chipRemoveTotal is surfaced
		// so the live header can mirror the chart's stack + chipRemoveTotal - buyIn.
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
		// profitLoss = 900 + 300 - 1300 = -100
		expect(result.profitLoss).toBe(-100);
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
		// profitLoss = (0 + 0) - (200 + 20) = -220
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

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

type SelectResult = Record<string, unknown>[];

function makeSelectResultNode(value: SelectResult): Promise<SelectResult> & {
	orderBy: ReturnType<typeof vi.fn>;
	limit: ReturnType<typeof vi.fn>;
	where: ReturnType<typeof vi.fn>;
} {
	const resolved = Promise.resolve(value);
	const chainMethods = {
		orderBy: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
		limit: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
		where: vi.fn().mockImplementation(() => makeSelectResultNode(value)),
	};
	return new Proxy(resolved, {
		get(target, prop, receiver) {
			if (prop in chainMethods) {
				return chainMethods[prop as keyof typeof chainMethods];
			}
			const val = Reflect.get(target, prop, receiver);
			return typeof val === "function" ? val.bind(target) : val;
		},
	}) as Promise<SelectResult> & typeof chainMethods;
}

function makeChainableDb(selectSequence: SelectResult[]) {
	let selectCallIndex = 0;

	const updateChain = {
		set: vi.fn(),
		where: vi.fn().mockResolvedValue(undefined),
	};
	updateChain.set.mockReturnValue(updateChain);

	const deleteChain = {
		where: vi.fn().mockResolvedValue(undefined),
	};

	const insertChain = {
		values: vi.fn().mockResolvedValue(undefined),
	};

	const db = {
		select: vi.fn().mockImplementation(() => {
			const result = selectSequence[selectCallIndex] ?? [];
			selectCallIndex++;
			return {
				from: vi.fn().mockReturnValue(makeSelectResultNode(result)),
			};
		}),
		update: vi.fn().mockReturnValue(updateChain),
		delete: vi.fn().mockReturnValue(deleteChain),
		insert: vi.fn().mockReturnValue(insertChain),
		_updateChain: updateChain,
		_deleteChain: deleteChain,
		_insertChain: insertChain,
	};

	return db;
}

function makeGameSession(overrides: Record<string, unknown> = {}) {
	return {
		id: "session-1",
		userId: "user-1",
		kind: "cash_game",
		status: "active",
		source: "live",
		sessionDate: new Date("2024-01-01T10:00:00Z"),
		startedAt: new Date("2024-01-01T10:00:00Z"),
		endedAt: null,
		breakMinutes: null,
		memo: null,
		roomId: null,
		currencyId: "currency-1",
		heroSeatPosition: null,
		createdAt: new Date("2024-01-01T10:00:00Z"),
		updatedAt: new Date("2024-01-01T10:00:00Z"),
		...overrides,
	};
}

function makeSessionEvent(
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt: Date = new Date("2024-01-01T10:00:00Z"),
	sortOrder = 0
) {
	return {
		id: crypto.randomUUID(),
		sessionId: "session-1",
		eventType,
		occurredAt,
		sortOrder,
		payload: JSON.stringify(payload),
		createdAt: new Date("2024-01-01T10:00:00Z"),
		updatedAt: new Date("2024-01-01T10:00:00Z"),
	};
}

// ---------------------------------------------------------------------------
// recalculateCashGameSession tests
// ---------------------------------------------------------------------------

describe("recalculateCashGameSession — active session (no session_end)", () => {
	it("updates gameSession status to active and clears any currency transaction", async () => {
		const events = [makeSessionEvent("session_start", { buyInAmount: 500 })];
		const session = makeGameSession();

		const db = makeChainableDb([events, [session]]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" })
		);
		expect(db.delete).toHaveBeenCalledTimes(1);
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("returns early without touching sessionCashDetail when session not found", async () => {
		const events = [makeSessionEvent("session_start", { buyInAmount: 100 })];

		const db = makeChainableDb([events, []]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).not.toHaveBeenCalled();
		expect(db.insert).not.toHaveBeenCalled();
	});
});

describe("recalculateCashGameSession — completed session", () => {
	it("updates gameSession, upserts sessionCashDetail (insert when missing), and syncs currencyTransaction", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T12:00:00Z");
		const events = [
			makeSessionEvent("session_start", { buyInAmount: 500 }, startedAt, 0),
			makeSessionEvent("session_end", { cashOutAmount: 700 }, endedAt, 1),
		];
		const session = makeGameSession({ currencyId: "currency-1" });
		const existingTransactionType = [
			{
				id: "tt-1",
				name: "Session Result",
				userId: "user-1",
				updatedAt: new Date(),
			},
		];

		const db = makeChainableDb([
			events,
			[session],
			[],
			[],
			existingTransactionType,
		]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(2);
		expect(db.insert).toHaveBeenCalledTimes(2);

		const insertCalls = db._insertChain.values.mock.calls;
		const cashDetailInsert = insertCalls.find((args: unknown[]) => {
			const arg = args[0] as Record<string, unknown>;
			return "buyIn" in arg || "cashOut" in arg;
		});
		expect(cashDetailInsert).toBeDefined();
		const inserted = cashDetailInsert?.[0] as Record<string, unknown>;
		expect(inserted.buyIn).toBe(500);
		expect(inserted.cashOut).toBe(700);
	});

	it("updates existing sessionCashDetail when it already exists", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T12:00:00Z");
		const events = [
			makeSessionEvent("session_start", { buyInAmount: 200 }, startedAt, 0),
			makeSessionEvent("session_end", { cashOutAmount: 350 }, endedAt, 1),
		];
		const session = makeGameSession({ currencyId: null });
		const existingDetail = [
			{ sessionId: "session-1", buyIn: 200, cashOut: null, evCashOut: null },
		];

		const db = makeChainableDb([events, [session], existingDetail, []]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(3);
	});

	it("skips currencyTransaction sync when currencyId is null", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T12:00:00Z");
		const events = [
			makeSessionEvent("session_start", { buyInAmount: 300 }, startedAt, 0),
			makeSessionEvent("session_end", { cashOutAmount: 300 }, endedAt, 1),
		];
		const session = makeGameSession({ currencyId: null });
		const existingDetail = [
			{ sessionId: "session-1", buyIn: 300, cashOut: null, evCashOut: null },
		];

		const db = makeChainableDb([events, [session], existingDetail, []]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({ buyIn: 300, cashOut: 300 })
		);
		const insertedValues = db._insertChain.values.mock.calls.flat() as Record<
			string,
			unknown
		>[];
		const txInserts = insertedValues.filter(
			(v) => "currencyId" in v && "transactionTypeId" in v
		);
		expect(txInserts).toHaveLength(0);
	});

	it("updates existing currencyTransaction when one is already linked", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T12:00:00Z");
		const events = [
			makeSessionEvent("session_start", { buyInAmount: 100 }, startedAt, 0),
			makeSessionEvent("session_end", { cashOutAmount: 200 }, endedAt, 1),
		];
		const session = makeGameSession({ currencyId: "currency-1" });
		const existingDetail = [
			{ sessionId: "session-1", buyIn: 100, cashOut: null, evCashOut: null },
		];
		const existingTx = [{ id: "tx-1", currencyId: "currency-1", amount: 50 }];

		const db = makeChainableDb([events, [session], existingDetail, existingTx]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		const updateSetCalls = db._updateChain.set.mock.calls as [
			Record<string, unknown>,
		][];
		const txUpdate = updateSetCalls.find(([arg]) => "amount" in arg);
		expect(txUpdate).toBeDefined();
		expect(txUpdate?.[0].amount).toBe(100);
		expect(txUpdate?.[0].currencyId).toBe("currency-1");
		expect(txUpdate?.[0].transactedAt).toEqual(startedAt);
	});
});

describe("recalculateCashGameSession — paused session", () => {
	it("sets status to paused and clears currency transaction", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const pausedAt = new Date("2024-01-01T11:00:00Z");
		const events = [
			makeSessionEvent("session_start", { buyInAmount: 300 }, startedAt, 0),
			makeSessionEvent("session_pause", {}, pausedAt, 1),
		];
		const session = makeGameSession({ currencyId: "currency-1" });

		const db = makeChainableDb([events, [session]]);

		await recalculateCashGameSession(
			db as unknown as Parameters<typeof recalculateCashGameSession>[0],
			"session-1",
			"user-1"
		);

		const setCall = db._updateChain.set.mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(setCall[0].status).toBe("paused");
		expect(setCall[0].endedAt).toBeNull();
		expect(db.delete).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// recalculateTournamentSession tests
// ---------------------------------------------------------------------------

describe("recalculateTournamentSession — active session", () => {
	it("updates gameSession status to active and clears any currency transaction", async () => {
		const events = [
			makeSessionEvent("session_start", { timerStartedAt: null }),
		];
		const session = makeGameSession({ kind: "tournament" });

		const db = makeChainableDb([events, [session]]);

		await recalculateTournamentSession(
			db as unknown as Parameters<typeof recalculateTournamentSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		const setCall = db._updateChain.set.mock.calls[0] as [
			Record<string, unknown>,
		];
		expect(setCall[0].status).toBe("active");
		expect(db.delete).toHaveBeenCalledTimes(1);
	});

	it("returns early when session is not found", async () => {
		const events = [
			makeSessionEvent("session_start", { timerStartedAt: null }),
		];

		const db = makeChainableDb([events, []]);

		await recalculateTournamentSession(
			db as unknown as Parameters<typeof recalculateTournamentSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).not.toHaveBeenCalled();
	});
});

describe("recalculateTournamentSession — completed session, no tournamentId", () => {
	it("updates gameSession, inserts sessionTournamentDetail, and syncs currencyTransaction", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T14:00:00Z");
		const events = [
			makeSessionEvent("session_start", { timerStartedAt: null }, startedAt, 0),
			makeSessionEvent(
				"session_end",
				{
					beforeDeadline: false,
					placement: 1,
					totalEntries: 50,
					prizeMoney: 2000,
					bountyPrizes: 0,
				},
				endedAt,
				1
			),
		];
		const session = makeGameSession({
			kind: "tournament",
			currencyId: "currency-1",
		});
		const existingDetail: Record<string, unknown>[] = [];
		const existingTransactionType = [
			{
				id: "tt-1",
				name: "Session Result",
				userId: "user-1",
				updatedAt: new Date(),
			},
		];

		const db = makeChainableDb([
			events,
			[session],
			existingDetail,
			[], // session_chip_purchase rows (syncChipPurchaseResults)
			[], // existing currencyTransaction
			existingTransactionType,
		]);

		await recalculateTournamentSession(
			db as unknown as Parameters<typeof recalculateTournamentSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(2);
		expect(db.insert).toHaveBeenCalledTimes(2);

		const insertCalls = db._insertChain.values.mock.calls;
		const detailInsert = insertCalls.find((args: unknown[]) => {
			const arg = args[0] as Record<string, unknown>;
			return "placement" in arg || "prizeMoney" in arg;
		});
		expect(detailInsert).toBeDefined();
		const detail = detailInsert?.[0] as Record<string, unknown>;
		expect(detail.placement).toBe(1);
		expect(detail.totalEntries).toBe(50);
		expect(detail.prizeMoney).toBe(2000);
	});

	it("updates existing sessionTournamentDetail when it already exists", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T14:00:00Z");
		const events = [
			makeSessionEvent("session_start", { timerStartedAt: null }, startedAt, 0),
			makeSessionEvent(
				"session_end",
				{
					beforeDeadline: true,
					prizeMoney: 0,
					bountyPrizes: 0,
				},
				endedAt,
				1
			),
		];
		const session = makeGameSession({ kind: "tournament", currencyId: null });
		const existingDetail = [
			{
				sessionId: "session-1",
				tournamentId: null,
				tournamentBuyIn: 5000,
				entryFee: 500,
				placement: null,
				totalEntries: null,
				beforeDeadline: null,
				prizeMoney: null,
				bountyPrizes: null,
				timerStartedAt: null,
			},
		];

		const db = makeChainableDb([
			events,
			[session],
			existingDetail,
			[], // session_chip_purchase rows (syncChipPurchaseResults)
		]);

		await recalculateTournamentSession(
			db as unknown as Parameters<typeof recalculateTournamentSession>[0],
			"session-1",
			"user-1"
		);

		expect(db.update).toHaveBeenCalledTimes(3);
		const updateSetCalls = db._updateChain.set.mock.calls as [
			Record<string, unknown>,
		][];
		const detailUpdate = updateSetCalls.find(
			([arg]) => "beforeDeadline" in arg
		);
		expect(detailUpdate).toBeDefined();
		expect(detailUpdate?.[0].beforeDeadline).toBe(true);
	});
});

describe("recalculateTournamentSession — completed with tournamentId and linked buy-in", () => {
	it("reads tournament master data when detail has tournamentId but no local buy-in", async () => {
		const startedAt = new Date("2024-01-01T10:00:00Z");
		const endedAt = new Date("2024-01-01T14:00:00Z");
		const events = [
			makeSessionEvent("session_start", { timerStartedAt: null }, startedAt, 0),
			makeSessionEvent(
				"session_end",
				{
					beforeDeadline: false,
					placement: 3,
					totalEntries: 100,
					prizeMoney: 500,
					bountyPrizes: 0,
				},
				endedAt,
				1
			),
		];
		const session = makeGameSession({
			kind: "tournament",
			currencyId: "currency-1",
		});
		const existingDetail = [
			{
				sessionId: "session-1",
				tournamentId: "tournament-1",
				tournamentBuyIn: null,
				entryFee: null,
				placement: null,
				totalEntries: null,
				beforeDeadline: null,
				prizeMoney: null,
				bountyPrizes: null,
				timerStartedAt: null,
			},
		];
		const tournamentMaster = [{ buyIn: 10_000, entryFee: 1000 }];
		const existingTx = [{ id: "tx-1", amount: 0 }];

		const db = makeChainableDb([
			events,
			[session],
			existingDetail,
			tournamentMaster,
			[], // session_chip_purchase rows (syncChipPurchaseResults)
			existingTx,
		]);

		await recalculateTournamentSession(
			db as unknown as Parameters<typeof recalculateTournamentSession>[0],
			"session-1",
			"user-1"
		);

		const updateSetCalls = db._updateChain.set.mock.calls as [
			Record<string, unknown>,
		][];
		const txUpdate = updateSetCalls.find(([arg]) => "amount" in arg);
		expect(txUpdate).toBeDefined();
		// profitLoss = 500 - (10000 + 1000) = -10500
		expect(txUpdate?.[0].amount).toBe(-10_500);
	});
});

// ---------------------------------------------------------------------------
// getSessionResultTypeId tests
// ---------------------------------------------------------------------------

describe("getSessionResultTypeId", () => {
	it("returns existing typeId when Session Result type already exists", async () => {
		const existingType = [
			{
				id: "tt-existing",
				name: "Session Result",
				userId: "user-1",
				updatedAt: new Date(),
			},
		];
		const db = makeChainableDb([existingType]);

		const result = await getSessionResultTypeId(
			db as unknown as Parameters<typeof getSessionResultTypeId>[0],
			"user-1"
		);

		expect(result).toBe("tt-existing");
		expect(db.insert).not.toHaveBeenCalled();
	});

	it("inserts a new Session Result type and returns its id when none exists", async () => {
		const db = makeChainableDb([[]]);

		const result = await getSessionResultTypeId(
			db as unknown as Parameters<typeof getSessionResultTypeId>[0],
			"user-1"
		);

		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		expect(db.insert).toHaveBeenCalledTimes(1);
		const insertedValues = db._insertChain.values.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(insertedValues.name).toBe("Session Result");
		expect(insertedValues.userId).toBe("user-1");
	});
});
