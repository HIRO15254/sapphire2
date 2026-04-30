import { computeCashGamePLFromEvents } from "@sapphire2/api/services/live-session-pl";
import { describe, expect, it } from "vitest";
import {
	deriveCashGameTimeline,
	deriveTournamentTimeline,
	type TimelineEvent,
} from "@/features/live-sessions/utils/session-timeline";

const T0 = new Date("2026-04-01T10:00:00Z").getTime();

function event(
	overrides: Partial<TimelineEvent> & {
		eventType: string;
		payload: unknown;
		offsetMin?: number;
	}
): TimelineEvent {
	const { offsetMin, ...rest } = overrides;
	return {
		occurredAt: new Date(T0 + (offsetMin ?? 0) * 60_000).toISOString(),
		...rest,
	} as TimelineEvent;
}

// Reuse the API's serialized-payload signature so we can cross-check final values.
function toServerEvent(e: TimelineEvent): {
	eventType: string;
	payload: string;
} {
	return { eventType: e.eventType, payload: JSON.stringify(e.payload) };
}

describe("deriveCashGameTimeline", () => {
	it("returns an empty array when no events are present", () => {
		expect(deriveCashGameTimeline([])).toEqual([]);
	});

	it("returns an empty array when session_start is missing (no anchor)", () => {
		const events = [
			event({
				eventType: "update_stack",
				payload: { stackAmount: 5000 },
				offsetMin: 5,
			}),
		];
		expect(deriveCashGameTimeline(events)).toEqual([]);
	});

	it("starts at pl=0 / evPl=0 on session_start", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
		];
		const points = deriveCashGameTimeline(events);
		expect(points).toEqual([{ t: 0, pl: 0, evPl: 0 }]);
	});

	it("update_stack snapshots running pl as stack - totalBuyIn", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 12_000 },
				offsetMin: 30,
			}),
		];
		const points = deriveCashGameTimeline(events);
		expect(points).toHaveLength(2);
		expect(points[1]).toEqual({ t: 30 * 60_000, pl: 2000, evPl: 2000 });
	});

	it("chips_add_remove (positive) leaves pl unchanged but increases buy-in basis", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 12_000 },
				offsetMin: 30,
			}),
			event({
				eventType: "chips_add_remove",
				payload: { amount: 5000 },
				offsetMin: 31,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 17_000 },
				offsetMin: 32,
			}),
		];
		const points = deriveCashGameTimeline(events);
		// At chips_add_remove(+): stack=17000 (was 12000 + 5000), totalBuyIn=15000 → pl unchanged at 2000
		expect(points[2]).toEqual({ t: 31 * 60_000, pl: 2000, evPl: 2000 });
		// Subsequent update_stack repeats the same pl when stack matches totalBuyIn shift
		expect(points[3]).toEqual({ t: 32 * 60_000, pl: 2000, evPl: 2000 });
	});

	it("chips_add_remove (negative) accumulates chipRemoveTotal so pl is stable", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 12_000 },
				offsetMin: 30,
			}),
			event({
				eventType: "chips_add_remove",
				payload: { amount: -3000 },
				offsetMin: 31,
			}),
		];
		const points = deriveCashGameTimeline(events);
		// stack=9000, chipRemoveTotal=3000, totalBuyIn=10000 → pl = 9000 + 3000 - 10000 = 2000
		expect(points[2]).toEqual({ t: 31 * 60_000, pl: 2000, evPl: 2000 });
	});

	it("all_in adds positive evDiff when wins underperform equity", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			// pot=1000, trials=1, equity=60% (=600 EV), wins=0 (=0 actual) → evDiff=+600
			event({
				eventType: "all_in",
				payload: { potSize: 1000, trials: 1, equity: 60, wins: 0 },
				offsetMin: 5,
			}),
		];
		const points = deriveCashGameTimeline(events);
		expect(points[1]).toEqual({ t: 5 * 60_000, pl: 0, evPl: 600 });
	});

	it("multiple all_in events accumulate evDiff", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "all_in",
				payload: { potSize: 1000, trials: 1, equity: 60, wins: 0 },
				offsetMin: 5,
			}),
			event({
				eventType: "all_in",
				payload: { potSize: 500, trials: 1, equity: 50, wins: 1 },
				offsetMin: 10,
			}),
		];
		const points = deriveCashGameTimeline(events);
		// 1st: +600. 2nd: 500*0.5 - 500*1 = -250 → cumulative evDiff = 350
		expect(points[2]?.evPl).toBe(350);
	});

	it("session_end snapshots final pl matching computeCashGamePLFromEvents", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 15_000 },
				offsetMin: 30,
			}),
			event({
				eventType: "all_in",
				payload: { potSize: 1000, trials: 1, equity: 60, wins: 0 },
				offsetMin: 35,
			}),
			event({
				eventType: "session_end",
				payload: { cashOutAmount: 14_000 },
				offsetMin: 60,
			}),
		];
		const points = deriveCashGameTimeline(events);
		const finalServer = computeCashGamePLFromEvents(events.map(toServerEvent));
		const last = points.at(-1);
		expect(last?.pl).toBe(finalServer.profitLoss);
		expect(last?.evPl).toBe((finalServer.profitLoss ?? 0) + finalServer.evDiff);
	});

	it("ignores unrelated event types (player_join, memo, pause, resume)", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				offsetMin: 0,
			}),
			event({
				eventType: "player_join",
				payload: { isHero: true, seatPosition: 3 },
				offsetMin: 1,
			}),
			event({
				eventType: "memo",
				payload: { text: "hi" },
				offsetMin: 2,
			}),
			event({
				eventType: "session_pause",
				payload: {},
				offsetMin: 3,
			}),
			event({
				eventType: "session_resume",
				payload: {},
				offsetMin: 4,
			}),
		];
		const points = deriveCashGameTimeline(events);
		expect(points).toHaveLength(1);
		expect(points[0]).toEqual({ t: 0, pl: 0, evPl: 0 });
	});

	it("rejects malformed payloads via Zod (throws)", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: { buyInAmount: -5 },
				offsetMin: 0,
			}),
		];
		expect(() => deriveCashGameTimeline(events)).toThrow();
	});
});

describe("deriveTournamentTimeline", () => {
	it("returns an empty array for no events", () => {
		expect(deriveTournamentTimeline([])).toEqual([]);
	});

	it("returns an empty array when session_start is missing", () => {
		const events = [
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 0,
			}),
		];
		expect(deriveTournamentTimeline(events)).toEqual([]);
	});

	it("first update_stack establishes the starting stack and emits null averageStack until totalEntries arrives", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points).toHaveLength(2);
		expect(points[1]).toEqual({
			t: 5 * 60_000,
			stack: 10_000,
			averageStack: null,
		});
	});

	it("computes averageStack = startingStack * totalEntries / remainingPlayers when both are present", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
			event({
				eventType: "update_stack",
				payload: {
					stackAmount: 15_000,
					remainingPlayers: 20,
					totalEntries: 50,
				},
				offsetMin: 30,
			}),
		];
		const points = deriveTournamentTimeline(events);
		// startingStack=10000 (from first update_stack)
		// averageStack = 10000 * 50 / 20 = 25000
		expect(points[2]).toEqual({
			t: 30 * 60_000,
			stack: 15_000,
			averageStack: 25_000,
		});
	});

	it("retains the latest known totalEntries/remainingPlayers across subsequent stack updates", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
			event({
				eventType: "update_stack",
				payload: {
					stackAmount: 15_000,
					remainingPlayers: 20,
					totalEntries: 50,
				},
				offsetMin: 30,
			}),
			// no remaining/total here — should reuse previous values
			event({
				eventType: "update_stack",
				payload: { stackAmount: 18_000 },
				offsetMin: 60,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points[3]).toEqual({
			t: 60 * 60_000,
			stack: 18_000,
			averageStack: 25_000,
		});
	});

	it("purchase_chips adds chips to running stack", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
			event({
				eventType: "purchase_chips",
				payload: { name: "Rebuy", cost: 1000, chips: 5000 },
				offsetMin: 10,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points[2]).toEqual({
			t: 10 * 60_000,
			stack: 15_000,
			averageStack: null,
		});
	});

	it("ignores unrelated event types (memo, pause, resume, player_join)", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "memo",
				payload: { text: "x" },
				offsetMin: 1,
			}),
			event({
				eventType: "session_pause",
				payload: {},
				offsetMin: 2,
			}),
			event({
				eventType: "player_join",
				payload: { isHero: false },
				offsetMin: 3,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points).toEqual([{ t: 0, stack: 0, averageStack: null }]);
	});

	it("rejects malformed update_stack payload via Zod (throws)", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: -100 },
				offsetMin: 5,
			}),
		];
		expect(() => deriveTournamentTimeline(events)).toThrow();
	});

	it("session_end with non-winning placement drops stack to 0", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: {
					stackAmount: 10_000,
					remainingPlayers: 30,
					totalEntries: 50,
				},
				offsetMin: 5,
			}),
			event({
				eventType: "session_end",
				payload: {
					beforeDeadline: false,
					placement: 7,
					totalEntries: 50,
					prizeMoney: 0,
					bountyPrizes: 0,
				},
				offsetMin: 60,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points.at(-1)).toEqual({
			t: 60 * 60_000,
			stack: 0,
			averageStack: 25_000 / 1.5, // (10000 * 50) / 30 — preserved from last update_stack
		});
	});

	it("session_end with placement=1 sets stack to startingStack * totalEntries (winner takes all)", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
			event({
				eventType: "session_end",
				payload: {
					beforeDeadline: false,
					placement: 1,
					totalEntries: 50,
					prizeMoney: 100_000,
					bountyPrizes: 0,
				},
				offsetMin: 120,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points.at(-1)).toMatchObject({
			t: 120 * 60_000,
			stack: 10_000 * 50,
		});
	});

	it("session_end with placement=1 includes recorded chip purchases in winner stack", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: {
					stackAmount: 10_000,
					totalEntries: 50,
					chipPurchaseCounts: [
						{ name: "Rebuy", count: 20, chipsPerUnit: 10_000 },
					],
				},
				offsetMin: 5,
			}),
			event({
				eventType: "session_end",
				payload: {
					beforeDeadline: false,
					placement: 1,
					totalEntries: 50,
					prizeMoney: 100_000,
					bountyPrizes: 0,
				},
				offsetMin: 120,
			}),
		];
		const points = deriveTournamentTimeline(events);
		// 10000 * 50 + 20 * 10000 = 500000 + 200000 = 700000
		expect(points.at(-1)?.stack).toBe(700_000);
	});

	it("session_end with beforeDeadline=true does not alter the running stack", () => {
		const events = [
			event({
				eventType: "session_start",
				payload: {},
				offsetMin: 0,
			}),
			event({
				eventType: "update_stack",
				payload: { stackAmount: 10_000 },
				offsetMin: 5,
			}),
			event({
				eventType: "session_end",
				payload: {
					beforeDeadline: true,
					prizeMoney: 0,
					bountyPrizes: 0,
				},
				offsetMin: 60,
			}),
		];
		const points = deriveTournamentTimeline(events);
		expect(points.at(-1)).toMatchObject({ t: 60 * 60_000, stack: 10_000 });
	});
});
