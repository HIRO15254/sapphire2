import { QueryClient, type QueryKey } from "@tanstack/react-query";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

// ---------------------------------------------------------------------------
// Mock @/utils/trpc — queryOptions must return a stable queryKey shape
// [namespace, procedure, input] so getSessionQueryKeys can resolve predictable
// keys. We keep mutate/query stubs absent because these tests never call them.
// ---------------------------------------------------------------------------

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionEvent", "list", input),
				}),
			},
		},
	},
	trpcClient: {},
}));

// NOTE: import after vi.mock so the module picks up the mocked trpc.
const {
	buildOptimisticEvent,
	buildOptimisticSessionSummary,
	createSessionEventMutationOptions,
	deriveOptimisticStatus,
	getSessionQueryKeys,
} = await import("../optimistic-session-event");

// ---------------------------------------------------------------------------
// buildOptimisticSessionSummary
// ---------------------------------------------------------------------------

describe("buildOptimisticSessionSummary", () => {
	it("returns a new object (does not mutate input summary)", () => {
		const summary = { currentStack: 1000 };
		const result = buildOptimisticSessionSummary(summary, "update_stack", {
			stackAmount: 2000,
		});
		expect(result).not.toBe(summary);
		expect(summary).toEqual({ currentStack: 1000 });
		expect(result.currentStack).toBe(2000);
	});

	describe("default branch (unknown event types)", () => {
		it("preserves summary fields for unknown event type", () => {
			const summary = { foo: "bar", currentStack: 500 };
			const result = buildOptimisticSessionSummary(summary, "unknown_event", {
				stackAmount: 9999,
			});
			expect(result).toEqual({ foo: "bar", currentStack: 500 });
		});

		it("is a no-op for memo event type", () => {
			const summary = { x: 1 };
			const result = buildOptimisticSessionSummary(summary, "memo", {
				note: "hello",
			});
			expect(result).toEqual({ x: 1 });
		});

		it("is a no-op for session_pause and session_resume", () => {
			const summary = { currentStack: 100 };
			expect(
				buildOptimisticSessionSummary(summary, "session_pause", {})
			).toEqual({ currentStack: 100 });
			expect(
				buildOptimisticSessionSummary(summary, "session_resume", {})
			).toEqual({ currentStack: 100 });
		});
	});

	describe("session_start", () => {
		it("sets totalBuyIn from numeric buyInAmount", () => {
			const result = buildOptimisticSessionSummary({}, "session_start", {
				buyInAmount: 5000,
			});
			expect(result.totalBuyIn).toBe(5000);
		});

		it("ignores non-numeric buyInAmount", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 1000 },
				"session_start",
				{ buyInAmount: "5000" }
			);
			expect(result.totalBuyIn).toBe(1000);
		});

		it("accepts zero buyInAmount (valid number)", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 500 },
				"session_start",
				{ buyInAmount: 0 }
			);
			expect(result.totalBuyIn).toBe(0);
		});

		it("ignores missing buyInAmount", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 1500 },
				"session_start",
				{}
			);
			expect(result.totalBuyIn).toBe(1500);
		});
	});

	describe("session_end — cash game branch (cashOutAmount)", () => {
		it("sets cashOut and computes profitLoss = cashOut - totalBuyIn", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 10_000 },
				"session_end",
				{ cashOutAmount: 15_000 }
			);
			expect(result.cashOut).toBe(15_000);
			expect(result.profitLoss).toBe(5000);
		});

		it("handles negative profitLoss when cashOut < totalBuyIn", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 20_000 },
				"session_end",
				{ cashOutAmount: 5000 }
			);
			expect(result.profitLoss).toBe(-15_000);
		});

		it("treats missing totalBuyIn as 0 when computing profitLoss", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				cashOutAmount: 7000,
			});
			expect(result.cashOut).toBe(7000);
			expect(result.profitLoss).toBe(7000);
		});

		it("treats non-numeric totalBuyIn as 0 when computing profitLoss", () => {
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: "not-a-number" },
				"session_end",
				{ cashOutAmount: 3000 }
			);
			expect(result.profitLoss).toBe(3000);
		});

		it("ignores non-numeric cashOutAmount", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				cashOutAmount: "3000",
			});
			expect(result.cashOut).toBeUndefined();
			expect(result.profitLoss).toBeUndefined();
		});
	});

	describe("session_end — tournament branch (beforeDeadline=false)", () => {
		it("sets placement, totalEntries, and prizeMoney-only profitLoss", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: false,
				placement: 3,
				totalEntries: 120,
				prizeMoney: 50_000,
			});
			expect(result.placement).toBe(3);
			expect(result.totalEntries).toBe(120);
			expect(result.profitLoss).toBe(50_000);
		});

		it("adds bountyPrizes on top of prizeMoney", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: false,
				prizeMoney: 10_000,
				bountyPrizes: 2500,
			});
			expect(result.profitLoss).toBe(12_500);
		});

		it("uses 0 for bountyPrizes when missing", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: false,
				prizeMoney: 8000,
			});
			expect(result.profitLoss).toBe(8000);
		});

		it("ignores non-numeric bountyPrizes (treats as 0)", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: false,
				prizeMoney: 1000,
				bountyPrizes: "500",
			});
			expect(result.profitLoss).toBe(1000);
		});

		it("does not set placement when non-numeric", () => {
			const result = buildOptimisticSessionSummary(
				{ placement: 7 },
				"session_end",
				{ beforeDeadline: false, placement: "3" }
			);
			expect(result.placement).toBe(7);
		});

		it("does not set totalEntries when non-numeric", () => {
			const result = buildOptimisticSessionSummary(
				{ totalEntries: 50 },
				"session_end",
				{ beforeDeadline: false, totalEntries: "120" }
			);
			expect(result.totalEntries).toBe(50);
		});

		it("leaves profitLoss untouched when prizeMoney missing", () => {
			const result = buildOptimisticSessionSummary(
				{ profitLoss: 999 },
				"session_end",
				{ beforeDeadline: false, placement: 1 }
			);
			expect(result.profitLoss).toBe(999);
		});

		it("cashOutAmount present with beforeDeadline=false applies BOTH cash and tournament mutations", () => {
			// session_end applies cashOut branch (if cashOutAmount present) AND
			// tournament branch (if beforeDeadline===false). Both if/blocks run
			// independently — a hybrid payload therefore overwrites profitLoss twice.
			const result = buildOptimisticSessionSummary(
				{ totalBuyIn: 1000 },
				"session_end",
				{
					cashOutAmount: 3000,
					beforeDeadline: false,
					prizeMoney: 9000,
				}
			);
			expect(result.cashOut).toBe(3000);
			// cash branch: 3000 - 1000 = 2000, then tournament branch overwrites to 9000.
			expect(result.profitLoss).toBe(9000);
		});
	});

	describe("session_end — tournament branch (beforeDeadline=true)", () => {
		it("sets profitLoss from prizeMoney + bountyPrizes only", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: true,
				prizeMoney: 4000,
				bountyPrizes: 1000,
			});
			expect(result.profitLoss).toBe(5000);
		});

		it("does not set placement or totalEntries", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: true,
				placement: 1,
				totalEntries: 100,
				prizeMoney: 3000,
			});
			expect(result.placement).toBeUndefined();
			expect(result.totalEntries).toBeUndefined();
			expect(result.profitLoss).toBe(3000);
		});

		it("missing prizeMoney leaves profitLoss untouched", () => {
			const result = buildOptimisticSessionSummary(
				{ profitLoss: 42 },
				"session_end",
				{ beforeDeadline: true }
			);
			expect(result.profitLoss).toBe(42);
		});

		it("handles zero prizeMoney as valid numeric input", () => {
			const result = buildOptimisticSessionSummary({}, "session_end", {
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			});
			expect(result.profitLoss).toBe(0);
		});
	});

	describe("update_stack", () => {
		it("sets currentStack from numeric stackAmount", () => {
			const result = buildOptimisticSessionSummary(
				{ currentStack: 500 },
				"update_stack",
				{ stackAmount: 1250 }
			);
			expect(result.currentStack).toBe(1250);
		});

		it("accepts zero stackAmount", () => {
			const result = buildOptimisticSessionSummary(
				{ currentStack: 100 },
				"update_stack",
				{ stackAmount: 0 }
			);
			expect(result.currentStack).toBe(0);
		});

		it("accepts negative stackAmount as a valid number", () => {
			const result = buildOptimisticSessionSummary({}, "update_stack", {
				stackAmount: -50,
			});
			expect(result.currentStack).toBe(-50);
		});

		it("ignores non-numeric stackAmount", () => {
			const result = buildOptimisticSessionSummary(
				{ currentStack: 700 },
				"update_stack",
				{ stackAmount: "1250" }
			);
			expect(result.currentStack).toBe(700);
		});
	});

	describe("update_stack tournament info", () => {
		it("sets remainingPlayers from payload", () => {
			const result = buildOptimisticSessionSummary(
				{ remainingPlayers: 100 },
				"update_stack",
				{ remainingPlayers: 50 }
			);
			expect(result.remainingPlayers).toBe(50);
		});

		it("sets totalEntries from payload", () => {
			const result = buildOptimisticSessionSummary(
				{ totalEntries: 60 },
				"update_stack",
				{ totalEntries: 120 }
			);
			expect(result.totalEntries).toBe(120);
		});

		it("computes averageStack = round((startingStack * totalEntries + chipTotal) / remainingPlayers)", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 10_000, totalEntries: 100, remainingPlayers: 20 },
				"update_stack",
				{ remainingPlayers: 20 }
			);
			// (10_000 * 100 + 0) / 20 = 50_000
			expect(result.averageStack).toBe(50_000);
		});

		it("includes chipPurchaseCounts in chipTotal", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 10_000, totalEntries: 100, remainingPlayers: 20 },
				"update_stack",
				{
					chipPurchaseCounts: [
						{ name: "rebuy", count: 10, chipsPerUnit: 1000 },
						{ name: "addon", count: 5, chipsPerUnit: 2000 },
					],
				}
			);
			// (10_000 * 100 + 10*1000 + 5*2000) / 20 = (1_000_000 + 10_000 + 10_000) / 20 = 51_000
			expect(result.averageStack).toBe(51_000);
		});

		it("prefers payload.totalEntries over summary.totalEntries in computation", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 10, remainingPlayers: 5 },
				"update_stack",
				{ totalEntries: 20 }
			);
			// Uses payload totalEntries (20), keeps summary remainingPlayers (5).
			// (1000 * 20 + 0) / 5 = 4000
			expect(result.averageStack).toBe(4000);
			expect(result.totalEntries).toBe(20);
		});

		it("prefers payload.remainingPlayers over summary.remainingPlayers in computation", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 10, remainingPlayers: 5 },
				"update_stack",
				{ remainingPlayers: 2 }
			);
			// (1000 * 10) / 2 = 5000
			expect(result.averageStack).toBe(5000);
		});

		it("rounds the averageStack with Math.round", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 3, remainingPlayers: 2 },
				"update_stack",
				{}
			);
			// (1000 * 3) / 2 = 1500 → already integer, round no-op.
			expect(result.averageStack).toBe(1500);

			const fractional = buildOptimisticSessionSummary(
				{ startingStack: 100, totalEntries: 1, remainingPlayers: 3 },
				"update_stack",
				{}
			);
			// 100 / 3 = 33.333… → Math.round → 33
			expect(fractional.averageStack).toBe(33);
		});

		it("skips averageStack when startingStack is null", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: null, totalEntries: 10, remainingPlayers: 5 },
				"update_stack",
				{}
			);
			expect(result.averageStack).toBeUndefined();
		});

		it("skips averageStack when startingStack is 0 (falsy guard)", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 0, totalEntries: 10, remainingPlayers: 5 },
				"update_stack",
				{}
			);
			expect(result.averageStack).toBeUndefined();
		});

		it("skips averageStack when totalEntries is 0 (falsy guard)", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 0, remainingPlayers: 5 },
				"update_stack",
				{}
			);
			expect(result.averageStack).toBeUndefined();
		});

		it("skips averageStack when remainingPlayers is 0 (division guard)", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 10, remainingPlayers: 5 },
				"update_stack",
				{ remainingPlayers: 0 }
			);
			// payload overrides summary remainingPlayers, but payload value 0 fails the `>0` guard.
			// However, because the branch `typeof typedPayload.remainingPlayers === "number"`
			// only controls the payload-vs-summary precedence inside the calc, and the outer
			// guard requires `remainingPlayers > 0`, zero is correctly skipped.
			expect(result.averageStack).toBeUndefined();
			// Top-level summary.remainingPlayers is still set from payload.
			expect(result.remainingPlayers).toBe(0);
		});

		it("skips averageStack when totalEntries is null in summary and absent in payload", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: null, remainingPlayers: 5 },
				"update_stack",
				{}
			);
			expect(result.averageStack).toBeUndefined();
		});

		it("handles empty chipPurchaseCounts array", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 10, remainingPlayers: 2 },
				"update_stack",
				{ chipPurchaseCounts: [] }
			);
			expect(result.averageStack).toBe(5000);
		});

		it("handles undefined chipPurchaseCounts (defaults to empty)", () => {
			const result = buildOptimisticSessionSummary(
				{ startingStack: 1000, totalEntries: 10, remainingPlayers: 2 },
				"update_stack",
				{}
			);
			expect(result.averageStack).toBe(5000);
		});
	});

	describe("all_in", () => {
		it("computes evDiff = current + potSize * (equity/100) - (potSize/trials) * wins", () => {
			const result = buildOptimisticSessionSummary({}, "all_in", {
				potSize: 1000,
				equity: 60,
				trials: 100,
				wins: 50,
			});
			// 0 + 1000 * 0.6 - (1000 / 100) * 50 = 600 - 500 = 100
			expect(result.evDiff).toBe(100);
		});

		it("accumulates on existing numeric evDiff", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 200 }, "all_in", {
				potSize: 500,
				equity: 50,
				trials: 50,
				wins: 25,
			});
			// 200 + 500 * 0.5 - (500 / 50) * 25 = 200 + 250 - 250 = 200
			expect(result.evDiff).toBe(200);
		});

		it("treats non-numeric evDiff as 0", () => {
			const result = buildOptimisticSessionSummary(
				{ evDiff: "oops" },
				"all_in",
				{ potSize: 1000, equity: 50, trials: 100, wins: 50 }
			);
			// 0 + 500 - 500 = 0
			expect(result.evDiff).toBe(0);
		});

		it("skips computation when trials is 0 (division guard)", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 42 }, "all_in", {
				potSize: 1000,
				equity: 50,
				trials: 0,
				wins: 0,
			});
			expect(result.evDiff).toBe(42);
		});

		it("skips computation when trials is missing", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 42 }, "all_in", {
				potSize: 1000,
				equity: 50,
				wins: 10,
			});
			expect(result.evDiff).toBe(42);
		});

		it("skips computation when potSize is missing", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 7 }, "all_in", {
				equity: 50,
				trials: 100,
				wins: 50,
			});
			expect(result.evDiff).toBe(7);
		});

		it("skips computation when equity is missing", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 9 }, "all_in", {
				potSize: 1000,
				trials: 100,
				wins: 50,
			});
			expect(result.evDiff).toBe(9);
		});

		it("skips computation when wins is missing", () => {
			const result = buildOptimisticSessionSummary({ evDiff: 3 }, "all_in", {
				potSize: 1000,
				equity: 50,
				trials: 100,
			});
			expect(result.evDiff).toBe(3);
		});

		it("handles negative evDiff values (losing all-ins)", () => {
			const result = buildOptimisticSessionSummary({}, "all_in", {
				potSize: 1000,
				equity: 30,
				trials: 1,
				wins: 1,
			});
			// 0 + 1000 * 0.3 - 1000 * 1 = 300 - 1000 = -700
			expect(result.evDiff).toBe(-700);
		});
	});

	describe("occurredAt handling", () => {
		it("sets lastUpdatedAt when occurredAt is truthy", () => {
			const result = buildOptimisticSessionSummary(
				{},
				"update_stack",
				{ stackAmount: 1000 },
				1_234_567_890
			);
			expect(result.lastUpdatedAt).toBe(1_234_567_890);
		});

		it("does not set lastUpdatedAt when occurredAt is undefined", () => {
			const result = buildOptimisticSessionSummary({}, "update_stack", {
				stackAmount: 1000,
			});
			expect(result.lastUpdatedAt).toBeUndefined();
		});

		it("does not set lastUpdatedAt when occurredAt is 0 (falsy)", () => {
			const result = buildOptimisticSessionSummary(
				{ lastUpdatedAt: 999 },
				"update_stack",
				{ stackAmount: 1000 },
				0
			);
			// 0 is falsy, so the if branch is skipped and old value is preserved from spread.
			expect(result.lastUpdatedAt).toBe(999);
		});
	});
});

// ---------------------------------------------------------------------------
// deriveOptimisticStatus
// ---------------------------------------------------------------------------

describe("deriveOptimisticStatus", () => {
	it("returns 'paused' for session_pause event", () => {
		expect(deriveOptimisticStatus("active", "session_pause")).toBe("paused");
		expect(deriveOptimisticStatus("paused", "session_pause")).toBe("paused");
		expect(deriveOptimisticStatus("completed", "session_pause")).toBe("paused");
	});

	it("returns 'active' for session_resume event", () => {
		expect(deriveOptimisticStatus("paused", "session_resume")).toBe("active");
		expect(deriveOptimisticStatus("active", "session_resume")).toBe("active");
	});

	it("returns 'completed' for session_end event", () => {
		expect(deriveOptimisticStatus("active", "session_end")).toBe("completed");
		expect(deriveOptimisticStatus("paused", "session_end")).toBe("completed");
	});

	it("passes through currentStatus for unrelated event types", () => {
		expect(deriveOptimisticStatus("active", "update_stack")).toBe("active");
		expect(deriveOptimisticStatus("paused", "memo")).toBe("paused");
		expect(deriveOptimisticStatus("completed", "all_in")).toBe("completed");
		expect(deriveOptimisticStatus("active", "anything_else")).toBe("active");
	});
});

// ---------------------------------------------------------------------------
// buildOptimisticEvent
// ---------------------------------------------------------------------------

describe("buildOptimisticEvent", () => {
	const FIXED_TIME = new Date("2026-04-24T12:00:00.000Z").getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_TIME);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("creates event with optimistic-<timestamp> id", () => {
		const event = buildOptimisticEvent("session_start", { buyInAmount: 1000 });
		expect(event.id).toBe(`optimistic-${FIXED_TIME}`);
	});

	it("preserves eventType verbatim", () => {
		const event = buildOptimisticEvent("update_stack", {});
		expect(event.eventType).toBe("update_stack");
	});

	it("preserves payload reference as-is", () => {
		const payload = { stackAmount: 500 };
		const event = buildOptimisticEvent("update_stack", payload);
		expect(event.payload).toBe(payload);
	});

	it("handles null payload", () => {
		const event = buildOptimisticEvent("memo", null);
		expect(event.payload).toBeNull();
	});

	it("sets occurredAt to current ISO timestamp", () => {
		const event = buildOptimisticEvent("session_start", {});
		expect(event.occurredAt).toBe("2026-04-24T12:00:00.000Z");
	});

	it("satisfies the SessionEvent shape", () => {
		const event: SessionEvent = buildOptimisticEvent("session_end", {
			cashOutAmount: 1000,
		});
		expect(event).toEqual({
			id: `optimistic-${FIXED_TIME}`,
			eventType: "session_end",
			payload: { cashOutAmount: 1000 },
			occurredAt: "2026-04-24T12:00:00.000Z",
		});
	});
});

// ---------------------------------------------------------------------------
// getSessionQueryKeys
// ---------------------------------------------------------------------------

describe("getSessionQueryKeys", () => {
	it("produces cash-game-scoped keys when sessionType is cash_game", () => {
		const keys = getSessionQueryKeys("sess-1", "cash_game");
		expect(keys.sessionKey).toEqual([
			"liveCashGameSession",
			"getById",
			{ id: "sess-1" },
		]);
		expect(keys.eventsKey).toEqual([
			"sessionEvent",
			"list",
			{ liveCashGameSessionId: "sess-1" },
		]);
		expect(keys.activeListKey).toEqual([
			"liveCashGameSession",
			"list",
			{ status: "active", limit: 1 },
		]);
		expect(keys.pausedListKey).toEqual([
			"liveCashGameSession",
			"list",
			{ status: "paused", limit: 1 },
		]);
		expect(keys.allListsKey).toEqual(["liveCashGameSession", "list", {}]);
	});

	it("produces tournament-scoped keys when sessionType is tournament", () => {
		const keys = getSessionQueryKeys("t-42", "tournament");
		expect(keys.sessionKey).toEqual([
			"liveTournamentSession",
			"getById",
			{ id: "t-42" },
		]);
		expect(keys.eventsKey).toEqual([
			"sessionEvent",
			"list",
			{ liveTournamentSessionId: "t-42" },
		]);
		expect(keys.activeListKey).toEqual([
			"liveTournamentSession",
			"list",
			{ status: "active", limit: 1 },
		]);
		expect(keys.pausedListKey).toEqual([
			"liveTournamentSession",
			"list",
			{ status: "paused", limit: 1 },
		]);
		expect(keys.allListsKey).toEqual(["liveTournamentSession", "list", {}]);
	});

	it("cash_game and tournament keys never collide for the same id", () => {
		const cash = getSessionQueryKeys("same-id", "cash_game");
		const tour = getSessionQueryKeys("same-id", "tournament");
		expect(cash.sessionKey).not.toEqual(tour.sessionKey);
		expect(cash.eventsKey).not.toEqual(tour.eventsKey);
		expect(cash.allListsKey).not.toEqual(tour.allListsKey);
	});
});

// ---------------------------------------------------------------------------
// createSessionEventMutationOptions
// ---------------------------------------------------------------------------

interface TestSession {
	status: "active" | "paused" | "completed";
	summary: Record<string, unknown>;
}

interface TestListItem {
	id: string;
	name: string;
	status?: string;
}

interface TestListData {
	items: TestListItem[];
	nextCursor?: string;
}

function makeQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
}

function seedCacheDefaults(
	queryClient: QueryClient,
	keys: {
		sessionKey: QueryKey;
		eventsKey: QueryKey;
		activeListKey: QueryKey;
		pausedListKey: QueryKey;
	},
	session: TestSession,
	existingEvents: SessionEvent[]
) {
	queryClient.setQueryData<TestSession>(keys.sessionKey, session);
	queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, existingEvents);
	queryClient.setQueryData<TestListData>(keys.activeListKey, {
		items: [{ id: "sess-1", name: "My Cash Session", status: "active" }],
	});
	queryClient.setQueryData<TestListData>(keys.pausedListKey, {
		items: [],
	});
}

describe("createSessionEventMutationOptions", () => {
	const FIXED_TIME = new Date("2026-04-24T12:00:00.000Z").getTime();

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_TIME);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("onMutate — optimistic writes", () => {
		it("appends an optimistic event to the events list", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: { totalBuyIn: 1000 } },
				[{ id: "e-1", eventType: "memo", payload: {}, occurredAt: "t0" }]
			);

			const options = createSessionEventMutationOptions<{ amount: number }>({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: ({ amount }) => ({ stackAmount: amount }),
			});

			await options.onMutate({ amount: 2500 });

			const events = queryClient.getQueryData<SessionEvent[]>(keys.eventsKey);
			expect(events).toHaveLength(2);
			expect(events?.[1]).toEqual({
				id: `optimistic-${FIXED_TIME}`,
				eventType: "update_stack",
				payload: { stackAmount: 2500 },
				occurredAt: "2026-04-24T12:00:00.000Z",
			});
		});

		it("initializes events list from [] when cache is empty", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			// Seed session but leave eventsKey undefined.
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "active",
				summary: {},
			});

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({ note: "hi" }),
			});

			await options.onMutate(undefined);

			const events = queryClient.getQueryData<SessionEvent[]>(keys.eventsKey);
			expect(events).toHaveLength(1);
			expect(events?.[0]?.eventType).toBe("memo");
		});

		it("updates session summary via buildOptimisticSessionSummary", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: { currentStack: 500 } },
				[]
			);

			const options = createSessionEventMutationOptions<{ amount: number }>({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: ({ amount }) => ({ stackAmount: amount }),
			});

			await options.onMutate({ amount: 9999 });

			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.summary.currentStack).toBe(9999);
			// Without changesStatus, status is preserved as-is.
			expect(session?.status).toBe("active");
		});

		it("leaves session cache untouched when no session data is present", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			// No sessionKey seed — updater returns old (undefined) unchanged.

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({}),
			});

			await options.onMutate(undefined);

			expect(queryClient.getQueryData(keys.sessionKey)).toBeUndefined();
		});

		it("preserves session.summary as undefined when old.summary is missing", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			queryClient.setQueryData<{ status: string }>(keys.sessionKey, {
				status: "active",
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: () => ({ stackAmount: 1000 }),
			});

			await options.onMutate(undefined);

			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.summary).toBeUndefined();
		});

		it("returns a SnapshotContext with previousSession / previousEvents / previousLists", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			const initialSession = {
				status: "active" as const,
				summary: { currentStack: 123 },
			};
			const initialEvents: SessionEvent[] = [
				{ id: "e-1", eventType: "memo", payload: {}, occurredAt: "t0" },
			];
			seedCacheDefaults(queryClient, keys, initialSession, initialEvents);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: () => ({ stackAmount: 1 }),
			});

			const context = await options.onMutate(undefined);

			expect(context.previousSession.kind).toBe("query");
			expect(context.previousEvents.kind).toBe("query");
			expect(context.previousLists.kind).toBe("queries");
			if (context.previousSession.kind === "query") {
				expect(context.previousSession.data).toEqual(initialSession);
				expect(context.previousSession.queryKey).toEqual(keys.sessionKey);
			}
			if (context.previousEvents.kind === "query") {
				expect(context.previousEvents.data).toEqual(initialEvents);
			}
		});
	});

	describe("onMutate — changesStatus + session_pause", () => {
		it("transitions session status to paused and moves session between lists", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: { currentStack: 100 } },
				[]
			);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_pause",
				getPayload: () => ({}),
				changesStatus: true,
			});

			await options.onMutate(undefined);

			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.status).toBe("paused");

			const activeList = queryClient.getQueryData<TestListData>(
				keys.activeListKey
			);
			const pausedList = queryClient.getQueryData<TestListData>(
				keys.pausedListKey
			);
			expect(activeList?.items).toEqual([]);
			expect(pausedList?.items).toHaveLength(1);
			expect(pausedList?.items[0]).toEqual({
				id: "sess-1",
				name: "My Cash Session",
				status: "paused",
			});
		});
	});

	describe("onMutate — changesStatus + session_resume", () => {
		it("transitions session status to active and moves session between lists", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			// Swap the default: active empty, paused has the item.
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "paused",
				summary: {},
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			queryClient.setQueryData<TestListData>(keys.activeListKey, { items: [] });
			queryClient.setQueryData<TestListData>(keys.pausedListKey, {
				items: [{ id: "sess-1", name: "Paused Cash", status: "paused" }],
			});

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_resume",
				getPayload: () => ({}),
				changesStatus: true,
			});

			await options.onMutate(undefined);

			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.status).toBe("active");

			const activeList = queryClient.getQueryData<TestListData>(
				keys.activeListKey
			);
			const pausedList = queryClient.getQueryData<TestListData>(
				keys.pausedListKey
			);
			expect(pausedList?.items).toEqual([]);
			expect(activeList?.items).toHaveLength(1);
			expect(activeList?.items[0]).toEqual({
				id: "sess-1",
				name: "Paused Cash",
				status: "active",
			});
		});
	});

	describe("onMutate — changesStatus=false (list moves suppressed)", () => {
		it("does not touch either list when changesStatus is false", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			const activeInitial = {
				items: [{ id: "sess-1", name: "Cash", status: "active" }],
			};
			const pausedInitial = { items: [] };
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "active",
				summary: {},
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			queryClient.setQueryData<TestListData>(keys.activeListKey, activeInitial);
			queryClient.setQueryData<TestListData>(keys.pausedListKey, pausedInitial);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: () => ({ stackAmount: 999 }),
				// changesStatus intentionally omitted
			});

			await options.onMutate(undefined);

			expect(queryClient.getQueryData(keys.activeListKey)).toEqual(
				activeInitial
			);
			expect(queryClient.getQueryData(keys.pausedListKey)).toEqual(
				pausedInitial
			);
		});
	});

	describe("onMutate — session not present in source list", () => {
		it("skips adding to destination when sessionItem is not found in fromKey", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "active",
				summary: {},
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			// Active list has a different session; sess-1 is absent.
			queryClient.setQueryData<TestListData>(keys.activeListKey, {
				items: [{ id: "other", name: "Other", status: "active" }],
			});
			queryClient.setQueryData<TestListData>(keys.pausedListKey, { items: [] });

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_pause",
				getPayload: () => ({}),
				changesStatus: true,
			});

			await options.onMutate(undefined);

			const pausedList = queryClient.getQueryData<TestListData>(
				keys.pausedListKey
			);
			// Destination list is never populated because sessionItem is undefined.
			expect(pausedList?.items).toEqual([]);
			// Active list is filtered (no-op since sess-1 wasn't there).
			const activeList = queryClient.getQueryData<TestListData>(
				keys.activeListKey
			);
			expect(activeList?.items).toEqual([
				{ id: "other", name: "Other", status: "active" },
			]);
		});

		it("handles missing source list (fromData undefined)", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "active",
				summary: {},
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			// activeListKey is intentionally NOT seeded.
			queryClient.setQueryData<TestListData>(keys.pausedListKey, { items: [] });

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_pause",
				getPayload: () => ({}),
				changesStatus: true,
			});

			await expect(options.onMutate(undefined)).resolves.toBeDefined();
			expect(queryClient.getQueryData(keys.activeListKey)).toBeUndefined();
			const pausedList = queryClient.getQueryData<TestListData>(
				keys.pausedListKey
			);
			expect(pausedList?.items).toEqual([]);
		});
	});

	describe("onMutate — cancelQueries called for session, events, and both lists", () => {
		it("invokes cancelQueries for each target queryKey", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: {} },
				[]
			);
			const cancelSpy = vi.spyOn(queryClient, "cancelQueries");

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({}),
			});

			await options.onMutate(undefined);

			expect(cancelSpy).toHaveBeenCalledTimes(4);
			const calls = cancelSpy.mock.calls.map((c) => c[0]);
			expect(calls).toEqual(
				expect.arrayContaining([
					{ queryKey: keys.sessionKey },
					{ queryKey: keys.eventsKey },
					{ queryKey: keys.activeListKey },
					{ queryKey: keys.pausedListKey },
				])
			);
		});
	});

	describe("onError — rollback behavior", () => {
		it("restores all three snapshot tiers via restoreSnapshots", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			const initialSession: TestSession = {
				status: "active",
				summary: { currentStack: 500 },
			};
			const initialEvents: SessionEvent[] = [
				{ id: "e-1", eventType: "memo", payload: {}, occurredAt: "t0" },
			];
			seedCacheDefaults(queryClient, keys, initialSession, initialEvents);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "update_stack",
				getPayload: () => ({ stackAmount: 9999 }),
			});

			const context = await options.onMutate(undefined);
			// Confirm optimistic write occurred.
			expect(
				queryClient.getQueryData<TestSession>(keys.sessionKey)?.summary
					.currentStack
			).toBe(9999);

			options.onError(new Error("boom"), undefined, context);

			// After rollback, cache is back to the initial state.
			expect(queryClient.getQueryData(keys.sessionKey)).toEqual(initialSession);
			expect(queryClient.getQueryData(keys.eventsKey)).toEqual(initialEvents);
		});

		it("restores list snapshot entries (both active and paused)", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			const initialActive = {
				items: [{ id: "sess-1", name: "Cash", status: "active" }],
			};
			const initialPaused: TestListData = { items: [] };
			queryClient.setQueryData<TestSession>(keys.sessionKey, {
				status: "active",
				summary: {},
			});
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			queryClient.setQueryData<TestListData>(keys.activeListKey, initialActive);
			queryClient.setQueryData<TestListData>(keys.pausedListKey, initialPaused);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_pause",
				getPayload: () => ({}),
				changesStatus: true,
			});

			const context = await options.onMutate(undefined);
			// List move happened.
			expect(
				queryClient.getQueryData<TestListData>(keys.activeListKey)?.items
			).toEqual([]);
			expect(
				queryClient.getQueryData<TestListData>(keys.pausedListKey)?.items
			).toHaveLength(1);

			options.onError(new Error("rollback"), undefined, context);

			expect(queryClient.getQueryData(keys.activeListKey)).toEqual(
				initialActive
			);
			expect(queryClient.getQueryData(keys.pausedListKey)).toEqual(
				initialPaused
			);
		});

		it("is a no-op when context is undefined", () => {
			const queryClient = makeQueryClient();
			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({}),
			});
			const setSpy = vi.spyOn(queryClient, "setQueryData");

			expect(() =>
				options.onError(new Error("x"), undefined, undefined)
			).not.toThrow();
			expect(setSpy).not.toHaveBeenCalled();
		});
	});

	describe("onSettled — invalidation behavior", () => {
		it("invalidates sessionKey, eventsKey, and allListsKey (as filters)", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			const invalidateSpy = vi
				.spyOn(queryClient, "invalidateQueries")
				.mockResolvedValue(undefined);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({}),
			});

			await options.onSettled();

			expect(invalidateSpy).toHaveBeenCalledTimes(3);
			const calls = invalidateSpy.mock.calls.map((c) => c[0]);
			expect(calls).toEqual(
				expect.arrayContaining([
					{ queryKey: keys.sessionKey },
					{ queryKey: keys.eventsKey },
					{ queryKey: keys.allListsKey },
				])
			);
		});

		it("awaits all invalidations in parallel", async () => {
			const queryClient = makeQueryClient();
			const resolvers: Array<() => void> = [];
			(queryClient.invalidateQueries as unknown as Mock) = vi.fn(
				() =>
					new Promise<void>((resolve) => {
						resolvers.push(resolve);
					})
			);

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "memo",
				getPayload: () => ({}),
			});

			const pending = options.onSettled();
			expect(resolvers).toHaveLength(3);
			for (const resolve of resolvers) {
				resolve();
			}
			await pending;
		});
	});

	describe("tournament session type integration", () => {
		it("uses tournament-scoped keys end-to-end", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("t-1", "tournament");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: { remainingPlayers: 100 } },
				[]
			);

			const options = createSessionEventMutationOptions<{
				remainingPlayers: number;
			}>({
				queryClient,
				sessionId: "t-1",
				sessionType: "tournament",
				eventType: "update_stack",
				getPayload: (v) => ({ remainingPlayers: v.remainingPlayers }),
			});

			await options.onMutate({ remainingPlayers: 50 });

			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.summary.remainingPlayers).toBe(50);
			const events = queryClient.getQueryData<SessionEvent[]>(keys.eventsKey);
			expect(events).toHaveLength(1);
			expect(events?.[0]?.eventType).toBe("update_stack");
		});
	});

	describe("getPayload integration", () => {
		it("forwards mutation variables into getPayload and then into the event", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			seedCacheDefaults(
				queryClient,
				keys,
				{ status: "active", summary: {} },
				[]
			);

			const getPayload = vi.fn((v: { buyIn: number }) => ({
				buyInAmount: v.buyIn,
			}));

			const options = createSessionEventMutationOptions<{ buyIn: number }>({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_start",
				getPayload,
			});

			await options.onMutate({ buyIn: 4200 });

			expect(getPayload).toHaveBeenCalledTimes(1);
			expect(getPayload).toHaveBeenCalledWith({ buyIn: 4200 });
			const events = queryClient.getQueryData<SessionEvent[]>(keys.eventsKey);
			expect(events?.[0]?.payload).toEqual({ buyInAmount: 4200 });
			// Summary also advanced because session_start is a known event type.
			const session = queryClient.getQueryData<TestSession>(keys.sessionKey);
			expect(session?.summary.totalBuyIn).toBe(4200);
		});
	});

	describe("changesStatus without a status on the session record", () => {
		it("keeps status as-is when old.status is falsy (no status derivation)", async () => {
			const queryClient = makeQueryClient();
			const keys = getSessionQueryKeys("sess-1", "cash_game");
			// Session without a `status` property.
			queryClient.setQueryData<{ summary: Record<string, unknown> }>(
				keys.sessionKey,
				{ summary: {} }
			);
			queryClient.setQueryData<SessionEvent[]>(keys.eventsKey, []);
			queryClient.setQueryData<TestListData>(keys.activeListKey, { items: [] });
			queryClient.setQueryData<TestListData>(keys.pausedListKey, { items: [] });

			const options = createSessionEventMutationOptions({
				queryClient,
				sessionId: "sess-1",
				sessionType: "cash_game",
				eventType: "session_pause",
				getPayload: () => ({}),
				changesStatus: true,
			});

			await options.onMutate(undefined);

			const session = queryClient.getQueryData<{
				status?: string;
				summary: Record<string, unknown>;
			}>(keys.sessionKey);
			// old.status was undefined, so nextStatus falls through to old.status (undefined).
			expect(session?.status).toBeUndefined();
		});
	});
});
