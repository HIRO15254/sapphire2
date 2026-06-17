import { describe, expect, it } from "vitest";
import {
	aggregateTournamentFlights,
	computeTournamentPLFromEvents,
	type FlightSessionInput,
} from "../services/live-session-pl";

/**
 * Integration coverage for the multi-day tournament engine: it wires the two
 * pure building blocks the live router relies on — computeTournamentPLFromEvents
 * (per-session result from the event log) and aggregateTournamentFlights (chain
 * → one "flight") — through the canonical flows so a regression in either shows
 * up here as a wrong combined result, not just a unit failure.
 */

function purchaseEvent(sessionChipPurchaseId: string, cost: number) {
	return {
		eventType: "purchase_chips",
		payload: JSON.stringify({
			sessionChipPurchaseId,
			name: "Rebuy",
			cost,
			chips: 10_000,
		}),
	};
}

function promoteEnd(bagStack: number) {
	return {
		eventType: "session_end",
		payload: JSON.stringify({ result: "promoted", bagStack }),
	};
}

function finishEnd(opts: {
	placement: number;
	totalEntries: number;
	prizeMoney: number;
	bountyPrizes: number;
}) {
	return {
		eventType: "session_end",
		payload: JSON.stringify({ beforeDeadline: false, ...opts }),
	};
}

/** Turn a session's events + buy-in/fee into a FlightSessionInput row. */
function toFlightInput(
	sessionId: string,
	previousSessionId: string | null,
	events: { eventType: string; payload: string }[],
	buyIn: number | null,
	entryFee: number | null
): FlightSessionInput {
	const pl = computeTournamentPLFromEvents(
		events,
		buyIn ?? undefined,
		entryFee ?? undefined
	);
	return {
		sessionId,
		previousSessionId,
		result: pl.result,
		buyIn,
		entryFee,
		chipPurchaseCost: pl.chipPurchaseCost,
		prizeMoney: pl.prizeMoney,
		bountyPrizes: pl.bountyPrizes,
		placement: pl.placement,
		totalEntries: pl.totalEntries,
	};
}

describe("multi-day tournament flow — promote → link → aggregate", () => {
	it("combines a Day1 promote and a Day2 finish into one flight", () => {
		// Day1: 10k buy-in + 1 rebuy of 5k, promoted with a 120k bag.
		const day1Events = [purchaseEvent("scp-1", 5000), promoteEnd(120_000)];
		const day1 = toFlightInput("day1", null, day1Events, 10_000, 0);
		expect(day1.result).toBe("promoted");
		// Day1 standalone realizes its cost as a loss: -(10000 + 0 + 5000).
		expect(
			computeTournamentPLFromEvents(day1Events, 10_000, 0).profitLoss
		).toBe(-15_000);

		// Day2: carries the bag (no buy-in), finishes 2nd for 100k.
		const day2Events = [
			finishEnd({
				placement: 2,
				totalEntries: 200,
				prizeMoney: 100_000,
				bountyPrizes: 0,
			}),
		];
		const day2 = toFlightInput("day2", "day1", day2Events, null, null);
		expect(day2.result).toBe("finished");

		const flights = aggregateTournamentFlights([day1, day2]);
		expect(flights).toHaveLength(1);
		const flight = flights[0];
		expect(flight.sessionIds).toEqual(["day1", "day2"]);
		// total cost = Day1 (10k + 5k rebuy) + Day2 (0) = 15k.
		expect(flight.totalCost).toBe(15_000);
		expect(flight.placement).toBe(2);
		expect(flight.totalEntries).toBe(200);
		expect(flight.prizeMoney).toBe(100_000);
		// combined P/L = 100k - 15k = 85k.
		expect(flight.profitLoss).toBe(85_000);
		expect(flight.isComplete).toBe(true);
	});

	it("keeps a busted re-entry separate from the surviving chain", () => {
		// First bullet busts (finished, no prize).
		const bustEvents = [
			finishEnd({
				placement: 180,
				totalEntries: 200,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		];
		const bust = toFlightInput("bust", null, bustEvents, 10_000, 0);

		// Second bullet promotes and the next day cashes.
		const day1 = toFlightInput("day1", null, [promoteEnd(80_000)], 10_000, 0);
		const day2 = toFlightInput(
			"day2",
			"day1",
			[
				finishEnd({
					placement: 5,
					totalEntries: 200,
					prizeMoney: 40_000,
					bountyPrizes: 0,
				}),
			],
			null,
			null
		);

		const flights = aggregateTournamentFlights([bust, day1, day2]);
		expect(flights).toHaveLength(2);
		const byHead = new Map(flights.map((f) => [f.headSessionId, f]));
		expect(byHead.get("bust")?.sessionIds).toEqual(["bust"]);
		// busted bullet: 0 prize - 10k cost.
		expect(byHead.get("bust")?.profitLoss).toBe(-10_000);
		expect(byHead.get("day1")?.sessionIds).toEqual(["day1", "day2"]);
		expect(byHead.get("day1")?.profitLoss).toBe(30_000);
	});

	it("treats a Day2 max-late entry (no link) as its own single-day flight", () => {
		// hasPreviousDay rule started without linking — a fresh entry with its
		// own buy-in.
		const maxLate = toFlightInput(
			"maxlate",
			null,
			[
				finishEnd({
					placement: 1,
					totalEntries: 50,
					prizeMoney: 60_000,
					bountyPrizes: 0,
				}),
			],
			20_000,
			0
		);
		const flights = aggregateTournamentFlights([maxLate]);
		expect(flights).toHaveLength(1);
		expect(flights[0].sessionIds).toEqual(["maxlate"]);
		expect(flights[0].totalCost).toBe(20_000);
		expect(flights[0].profitLoss).toBe(40_000);
	});

	it("leaves a single-day tournament unchanged (backward compatible)", () => {
		const single = toFlightInput(
			"solo",
			null,
			[
				finishEnd({
					placement: 10,
					totalEntries: 100,
					prizeMoney: 0,
					bountyPrizes: 0,
				}),
			],
			5000,
			500
		);
		const flights = aggregateTournamentFlights([single]);
		expect(flights).toHaveLength(1);
		expect(flights[0].totalCost).toBe(5500);
		expect(flights[0].profitLoss).toBe(-5500);
		expect(flights[0].isComplete).toBe(true);
	});

	it("reports an in-progress chain (tail still promoted) as incomplete", () => {
		const day1 = toFlightInput("d1", null, [promoteEnd(50_000)], 10_000, 0);
		const day2 = toFlightInput("d2", "d1", [promoteEnd(90_000)], null, null);
		const flights = aggregateTournamentFlights([day1, day2]);
		expect(flights).toHaveLength(1);
		expect(flights[0].sessionIds).toEqual(["d1", "d2"]);
		expect(flights[0].isComplete).toBe(false);
		expect(flights[0].prizeMoney).toBeNull();
		expect(flights[0].profitLoss).toBeNull();
		// cost is still tracked across the chain so far.
		expect(flights[0].totalCost).toBe(10_000);
	});
});
