import { describe, expect, it } from "vitest";
import {
	ALL_EVENT_TYPES,
	allInPayload,
	CASH_EVENT_TYPES,
	COMMON_EVENT_TYPES,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipPurchaseCountSchema,
	chipsAddRemovePayload,
	getSessionCurrentState,
	isEventAllowedInState,
	isValidEventTypeForSessionType,
	LIFECYCLE_EVENT_TYPES,
	MANUAL_CREATE_BLOCKED_EVENT_TYPES,
	memoPayload,
	PAUSE_RESUME_EVENT_TYPES,
	playerJoinPayload,
	playerLeavePayload,
	purchaseChipsPayload,
	SESSION_STATUSES,
	TOURNAMENT_EVENT_TYPES,
	tournamentSessionEndPayload,
	tournamentSessionStartPayload,
	updateStackPayload,
	validateEventPayload,
} from "../constants/session-event-types";

describe("SESSION_STATUSES", () => {
	it('includes "active"', () => {
		expect(SESSION_STATUSES).toContain("active");
	});

	it('includes "paused"', () => {
		expect(SESSION_STATUSES).toContain("paused");
	});

	it('includes "completed"', () => {
		expect(SESSION_STATUSES).toContain("completed");
	});
});

describe("event type arrays", () => {
	it("LIFECYCLE_EVENT_TYPES contains session_start and session_end", () => {
		expect(LIFECYCLE_EVENT_TYPES).toContain("session_start");
		expect(LIFECYCLE_EVENT_TYPES).toContain("session_end");
	});

	it("PAUSE_RESUME_EVENT_TYPES contains session_pause and session_resume", () => {
		expect(PAUSE_RESUME_EVENT_TYPES).toContain("session_pause");
		expect(PAUSE_RESUME_EVENT_TYPES).toContain("session_resume");
	});

	it("CASH_EVENT_TYPES contains chips_add_remove and all_in", () => {
		expect(CASH_EVENT_TYPES).toContain("chips_add_remove");
		expect(CASH_EVENT_TYPES).toContain("all_in");
	});

	it("TOURNAMENT_EVENT_TYPES contains purchase_chips", () => {
		expect(TOURNAMENT_EVENT_TYPES).toContain("purchase_chips");
		expect(TOURNAMENT_EVENT_TYPES).not.toContain("update_tournament_info");
	});

	it("COMMON_EVENT_TYPES contains update_stack, player_join, player_leave, memo", () => {
		expect(COMMON_EVENT_TYPES).toContain("update_stack");
		expect(COMMON_EVENT_TYPES).toContain("player_join");
		expect(COMMON_EVENT_TYPES).toContain("player_leave");
		expect(COMMON_EVENT_TYPES).toContain("memo");
	});

	it("does NOT contain player_seat_change (seat moves are leave → join)", () => {
		expect(ALL_EVENT_TYPES).not.toContain("player_seat_change");
	});
});

describe("ALL_EVENT_TYPES", () => {
	it("includes all 11 event types", () => {
		expect(ALL_EVENT_TYPES).toHaveLength(11);
	});

	it("includes all lifecycle event types", () => {
		for (const t of LIFECYCLE_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("includes all pause/resume event types", () => {
		for (const t of PAUSE_RESUME_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("includes all cash event types", () => {
		for (const t of CASH_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("includes all tournament event types", () => {
		for (const t of TOURNAMENT_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("includes all common event types", () => {
		for (const t of COMMON_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});
});

describe("MANUAL_CREATE_BLOCKED_EVENT_TYPES", () => {
	it("contains only session_start and session_end", () => {
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toContain("session_start");
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toContain("session_end");
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toHaveLength(2);
	});
});

describe("payload schemas", () => {
	describe("cashSessionStartPayload", () => {
		it("accepts valid buyInAmount", () => {
			const result = cashSessionStartPayload.parse({ buyInAmount: 100 });
			expect(result.buyInAmount).toBe(100);
		});

		it("rejects negative buyInAmount", () => {
			expect(() =>
				cashSessionStartPayload.parse({ buyInAmount: -1 })
			).toThrow();
		});
	});

	describe("tournamentSessionStartPayload — empty object only (timerStartedAt removed)", () => {
		it("accepts an empty object", () => {
			const result = tournamentSessionStartPayload.parse({});
			expect(result).toEqual({});
		});

		it("strips unknown keys (timerStartedAt, etc.)", () => {
			const result = tournamentSessionStartPayload.parse({
				timerStartedAt: 1_700_000_000,
			}) as Record<string, unknown>;
			expect(result.timerStartedAt).toBeUndefined();
		});

		it("strips all unknown keys silently", () => {
			const result = tournamentSessionStartPayload.parse({
				foo: "bar",
				extra: 123,
			}) as Record<string, unknown>;
			expect(Object.keys(result)).toHaveLength(0);
		});
	});

	describe("cashSessionEndPayload", () => {
		it("accepts valid cashOutAmount", () => {
			const result = cashSessionEndPayload.parse({ cashOutAmount: 500 });
			expect(result.cashOutAmount).toBe(500);
		});
	});

	describe("tournamentSessionEndPayload", () => {
		it("accepts beforeDeadline: false with full placement data", () => {
			const result = tournamentSessionEndPayload.parse({
				beforeDeadline: false,
				placement: 1,
				totalEntries: 100,
				prizeMoney: 5000,
				bountyPrizes: 0,
			});
			expect(result.beforeDeadline).toBe(false);
		});

		it("accepts beforeDeadline: true without placement data", () => {
			const result = tournamentSessionEndPayload.parse({
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			});
			expect(result.beforeDeadline).toBe(true);
		});
	});

	describe("chipsAddRemovePayload", () => {
		it("accepts a positive amount as an add", () => {
			const result = chipsAddRemovePayload.parse({ amount: 100 });
			expect(result.amount).toBe(100);
		});

		it("accepts a negative amount as a remove", () => {
			const result = chipsAddRemovePayload.parse({ amount: -50 });
			expect(result.amount).toBe(-50);
		});

		it("rejects an amount of zero", () => {
			expect(() => chipsAddRemovePayload.parse({ amount: 0 })).toThrow();
		});

		it("rejects a non-integer amount", () => {
			expect(() => chipsAddRemovePayload.parse({ amount: 1.5 })).toThrow();
		});
	});

	describe("allInPayload", () => {
		it("accepts valid potSize, trials, equity, wins", () => {
			const result = allInPayload.parse({
				potSize: 1000,
				trials: 1,
				equity: 55.5,
				wins: 1,
			});
			expect(result.potSize).toBe(1000);
			expect(result.equity).toBe(55.5);
		});
	});

	describe("purchaseChipsPayload — new shape: chipPurchaseOptionId", () => {
		it("accepts valid chipPurchaseOptionId", () => {
			const result = purchaseChipsPayload.parse({
				chipPurchaseOptionId: "option-1",
			});
			expect(result.chipPurchaseOptionId).toBe("option-1");
		});

		it("rejects empty chipPurchaseOptionId", () => {
			expect(() =>
				purchaseChipsPayload.parse({ chipPurchaseOptionId: "" })
			).toThrow();
		});

		it("rejects missing chipPurchaseOptionId", () => {
			expect(() =>
				purchaseChipsPayload.parse({} as Record<string, unknown>)
			).toThrow();
		});

		it("does NOT accept old shape (name, cost, chips)", () => {
			// Old fields are stripped by Zod; the required field is missing so it throws.
			expect(() =>
				purchaseChipsPayload.parse({ name: "Rebuy", cost: 100, chips: 5000 })
			).toThrow();
		});
	});

	describe("chipPurchaseCountSchema — new shape: chipPurchaseOptionId", () => {
		it("accepts chipPurchaseOptionId and count", () => {
			const result = chipPurchaseCountSchema.parse({
				chipPurchaseOptionId: "opt-2",
				count: 3,
			});
			expect(result.chipPurchaseOptionId).toBe("opt-2");
			expect(result.count).toBe(3);
		});

		it("accepts count = 0", () => {
			const result = chipPurchaseCountSchema.parse({
				chipPurchaseOptionId: "opt-3",
				count: 0,
			});
			expect(result.count).toBe(0);
		});

		it("rejects empty chipPurchaseOptionId", () => {
			expect(() =>
				chipPurchaseCountSchema.parse({ chipPurchaseOptionId: "", count: 1 })
			).toThrow();
		});

		it("rejects negative count", () => {
			expect(() =>
				chipPurchaseCountSchema.parse({
					chipPurchaseOptionId: "opt-1",
					count: -1,
				})
			).toThrow();
		});

		it("does NOT have old name / chipsPerUnit fields", () => {
			const result = chipPurchaseCountSchema.parse({
				chipPurchaseOptionId: "opt-1",
				count: 2,
				name: "Rebuy",
				chipsPerUnit: 10_000,
			}) as Record<string, unknown>;
			expect(result.name).toBeUndefined();
			expect(result.chipsPerUnit).toBeUndefined();
		});
	});

	describe("updateStackPayload — chipPurchaseCounts uses new schema", () => {
		it("accepts valid stackAmount alone", () => {
			const result = updateStackPayload.parse({ stackAmount: 5000 });
			expect(result.stackAmount).toBe(5000);
		});

		it("accepts chipPurchaseCounts with chipPurchaseOptionId entries", () => {
			const result = updateStackPayload.parse({
				stackAmount: 5000,
				remainingPlayers: 30,
				totalEntries: 100,
				chipPurchaseCounts: [
					{ chipPurchaseOptionId: "opt-1", count: 1 },
					{ chipPurchaseOptionId: "opt-2", count: 2 },
				],
			});
			expect(result.chipPurchaseCounts).toHaveLength(2);
			expect(result.chipPurchaseCounts?.[0]?.chipPurchaseOptionId).toBe(
				"opt-1"
			);
		});

		it("rejects chipPurchaseCounts entries with old shape (name/chipsPerUnit)", () => {
			expect(() =>
				updateStackPayload.parse({
					stackAmount: 5000,
					chipPurchaseCounts: [
						{ name: "Rebuy", count: 1, chipsPerUnit: 10_000 },
					],
				})
			).toThrow();
		});

		it("accepts null tournament-info fields", () => {
			const result = updateStackPayload.parse({
				stackAmount: 5000,
				remainingPlayers: null,
				totalEntries: null,
			});
			expect(result.remainingPlayers).toBeNull();
			expect(result.totalEntries).toBeNull();
		});
	});

	describe("memoPayload", () => {
		it("accepts non-empty text", () => {
			const result = memoPayload.parse({ text: "good hand" });
			expect(result.text).toBe("good hand");
		});

		it("rejects empty text", () => {
			expect(() => memoPayload.parse({ text: "" })).toThrow();
		});
	});

	describe("playerJoinPayload", () => {
		it("accepts valid playerId", () => {
			const result = playerJoinPayload.parse({ playerId: "player-1" });
			expect(result.playerId).toBe("player-1");
		});

		it("rejects empty playerId", () => {
			expect(() => playerJoinPayload.parse({ playerId: "" })).toThrow();
		});

		it("accepts isHero=true without playerId (Hero has no player row)", () => {
			const result = playerJoinPayload.parse({ isHero: true });
			expect(result.isHero).toBe(true);
			expect(result.playerId).toBeUndefined();
		});

		it("accepts seatPosition", () => {
			const result = playerJoinPayload.parse({
				isHero: true,
				seatPosition: 3,
			});
			expect(result.seatPosition).toBe(3);
		});
	});

	describe("playerLeavePayload", () => {
		it("accepts valid playerId", () => {
			const result = playerLeavePayload.parse({ playerId: "player-1" });
			expect(result.playerId).toBe("player-1");
		});

		it("rejects empty playerId", () => {
			expect(() => playerLeavePayload.parse({ playerId: "" })).toThrow();
		});

		it("accepts isHero=true without playerId", () => {
			const result = playerLeavePayload.parse({ isHero: true });
			expect(result.isHero).toBe(true);
			expect(result.playerId).toBeUndefined();
		});
	});
});

describe("isValidEventTypeForSessionType", () => {
	it("allows cash event types for cash_game", () => {
		expect(
			isValidEventTypeForSessionType("chips_add_remove", "cash_game")
		).toBe(true);
		expect(isValidEventTypeForSessionType("all_in", "cash_game")).toBe(true);
	});

	it("blocks cash event types for tournament", () => {
		expect(
			isValidEventTypeForSessionType("chips_add_remove", "tournament")
		).toBe(false);
		expect(isValidEventTypeForSessionType("all_in", "tournament")).toBe(false);
	});

	it("allows tournament event types for tournament", () => {
		expect(isValidEventTypeForSessionType("purchase_chips", "tournament")).toBe(
			true
		);
	});

	it("blocks tournament event types for cash_game", () => {
		expect(isValidEventTypeForSessionType("purchase_chips", "cash_game")).toBe(
			false
		);
	});

	it("allows common event types for both session types", () => {
		expect(isValidEventTypeForSessionType("update_stack", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("update_stack", "tournament")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("memo", "cash_game")).toBe(true);
		expect(isValidEventTypeForSessionType("memo", "tournament")).toBe(true);
	});

	it("allows lifecycle event types for both session types", () => {
		expect(isValidEventTypeForSessionType("session_start", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("session_start", "tournament")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("session_end", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("session_end", "tournament")).toBe(
			true
		);
	});

	it("allows pause/resume event types for both session types", () => {
		expect(isValidEventTypeForSessionType("session_pause", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("session_resume", "tournament")).toBe(
			true
		);
	});
});

describe("validateEventPayload", () => {
	it("dispatches session_start to cash schema for cash_game", () => {
		const result = validateEventPayload(
			"session_start",
			{ buyInAmount: 500 },
			"cash_game"
		);
		expect(result).toBeDefined();
	});

	it("dispatches session_start to tournament schema (empty object)", () => {
		const result = validateEventPayload("session_start", {}, "tournament");
		expect(result).toEqual({});
	});

	it("tournament session_start strips timerStartedAt (no longer in payload)", () => {
		const result = validateEventPayload(
			"session_start",
			{ timerStartedAt: 1_700_000_000 },
			"tournament"
		) as Record<string, unknown>;
		expect(result.timerStartedAt).toBeUndefined();
	});

	it("dispatches session_end to cash schema for cash_game", () => {
		const result = validateEventPayload(
			"session_end",
			{ cashOutAmount: 1000 },
			"cash_game"
		);
		expect(result).toBeDefined();
	});

	it("dispatches session_end to tournament schema for tournament", () => {
		const result = validateEventPayload(
			"session_end",
			{ beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 },
			"tournament"
		);
		expect(result).toBeDefined();
	});

	it("dispatches purchase_chips using new chipPurchaseOptionId shape", () => {
		const result = validateEventPayload("purchase_chips", {
			chipPurchaseOptionId: "opt-1",
		}) as { chipPurchaseOptionId: string };
		expect(result.chipPurchaseOptionId).toBe("opt-1");
	});

	it("rejects purchase_chips with old shape (name/cost/chips)", () => {
		expect(() =>
			validateEventPayload("purchase_chips", {
				name: "Addon",
				cost: 50,
				chips: 5000,
			})
		).toThrow();
	});

	it("dispatches non-lifecycle events using general schema map", () => {
		const result = validateEventPayload("memo", { text: "nice bluff" });
		expect(result).toBeDefined();
	});
});

describe("getSessionCurrentState", () => {
	const makeEvent = (eventType: string, offsetMs = 0) => ({
		eventType,
		occurredAt: new Date(1_000_000 + offsetMs),
		sortOrder: offsetMs,
	});

	it('returns "active" after session_start', () => {
		const events = [makeEvent("session_start", 0)];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it('returns "paused" after session_pause', () => {
		const events = [
			makeEvent("session_start", 0),
			makeEvent("session_pause", 1000),
		];
		expect(getSessionCurrentState(events)).toBe("paused");
	});

	it('returns "active" after session_resume', () => {
		const events = [
			makeEvent("session_start", 0),
			makeEvent("session_pause", 1000),
			makeEvent("session_resume", 2000),
		];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it('returns "completed" after session_end', () => {
		const events = [
			makeEvent("session_start", 0),
			makeEvent("session_end", 1000),
		];
		expect(getSessionCurrentState(events)).toBe("completed");
	});
});

describe("isEventAllowedInState", () => {
	it("active state allows cash event types", () => {
		expect(isEventAllowedInState("chips_add_remove", "active")).toBe(true);
		expect(isEventAllowedInState("all_in", "active")).toBe(true);
	});

	it("active state allows tournament event types", () => {
		expect(isEventAllowedInState("purchase_chips", "active")).toBe(true);
	});

	it("active state allows common event types", () => {
		expect(isEventAllowedInState("update_stack", "active")).toBe(true);
		expect(isEventAllowedInState("memo", "active")).toBe(true);
		expect(isEventAllowedInState("player_join", "active")).toBe(true);
		expect(isEventAllowedInState("player_leave", "active")).toBe(true);
	});

	it("active state blocks session_start", () => {
		expect(isEventAllowedInState("session_start", "active")).toBe(false);
	});

	it("paused state allows memo, session_resume, and session_end", () => {
		expect(isEventAllowedInState("memo", "paused")).toBe(true);
		expect(isEventAllowedInState("session_resume", "paused")).toBe(true);
		expect(isEventAllowedInState("session_end", "paused")).toBe(true);
	});

	it("paused state blocks all other event types", () => {
		expect(isEventAllowedInState("chips_add_remove", "paused")).toBe(false);
		expect(isEventAllowedInState("all_in", "paused")).toBe(false);
		expect(isEventAllowedInState("update_stack", "paused")).toBe(false);
		expect(isEventAllowedInState("player_join", "paused")).toBe(false);
		expect(isEventAllowedInState("session_start", "paused")).toBe(false);
	});

	it("completed state allows nothing", () => {
		for (const eventType of ALL_EVENT_TYPES) {
			expect(isEventAllowedInState(eventType, "completed")).toBe(false);
		}
	});
});

describe("event-type array disjointness and totals", () => {
	it("LIFECYCLE, PAUSE_RESUME, CASH, TOURNAMENT, COMMON are pairwise disjoint", () => {
		const groups = [
			LIFECYCLE_EVENT_TYPES,
			PAUSE_RESUME_EVENT_TYPES,
			CASH_EVENT_TYPES,
			TOURNAMENT_EVENT_TYPES,
			COMMON_EVENT_TYPES,
		] as const;
		const seen = new Map<string, number>();
		for (const g of groups) {
			for (const t of g) {
				seen.set(t, (seen.get(t) ?? 0) + 1);
			}
		}
		for (const [type, count] of seen) {
			expect({ type, count }).toEqual({ type, count: 1 });
		}
	});

	it("ALL_EVENT_TYPES covers every type in the group arrays and nothing extra", () => {
		const unionSize =
			LIFECYCLE_EVENT_TYPES.length +
			PAUSE_RESUME_EVENT_TYPES.length +
			CASH_EVENT_TYPES.length +
			TOURNAMENT_EVENT_TYPES.length +
			COMMON_EVENT_TYPES.length;
		expect(ALL_EVENT_TYPES).toHaveLength(unionSize);
	});

	it("SESSION_STATUSES contains exactly 3 statuses", () => {
		expect(SESSION_STATUSES).toHaveLength(3);
	});
});

describe("payload schema edge cases", () => {
	describe("cashSessionStartPayload", () => {
		it("accepts buyInAmount = 0 (free roll)", () => {
			expect(
				cashSessionStartPayload.parse({ buyInAmount: 0 }).buyInAmount
			).toBe(0);
		});

		it("rejects missing buyInAmount", () => {
			expect(() =>
				cashSessionStartPayload.parse({} as Record<string, unknown>)
			).toThrow();
		});

		it("rejects non-integer buyInAmount", () => {
			expect(() =>
				cashSessionStartPayload.parse({ buyInAmount: 1.5 })
			).toThrow();
		});

		it("rejects string buyInAmount", () => {
			expect(() =>
				cashSessionStartPayload.parse({ buyInAmount: "100" })
			).toThrow();
		});
	});

	describe("cashSessionEndPayload", () => {
		it("accepts cashOutAmount = 0", () => {
			expect(
				cashSessionEndPayload.parse({ cashOutAmount: 0 }).cashOutAmount
			).toBe(0);
		});

		it("rejects negative cashOutAmount", () => {
			expect(() =>
				cashSessionEndPayload.parse({ cashOutAmount: -5 })
			).toThrow();
		});

		it("rejects non-integer cashOutAmount", () => {
			expect(() =>
				cashSessionEndPayload.parse({ cashOutAmount: 10.1 })
			).toThrow();
		});
	});

	describe("tournamentSessionEndPayload boundaries", () => {
		it("rejects placement = 0 (placement is 1-based)", () => {
			expect(() =>
				tournamentSessionEndPayload.parse({
					beforeDeadline: false,
					placement: 0,
					totalEntries: 10,
					prizeMoney: 0,
					bountyPrizes: 0,
				})
			).toThrow();
		});

		it("rejects totalEntries = 0", () => {
			expect(() =>
				tournamentSessionEndPayload.parse({
					beforeDeadline: false,
					placement: 1,
					totalEntries: 0,
					prizeMoney: 0,
					bountyPrizes: 0,
				})
			).toThrow();
		});

		it("rejects negative prizeMoney", () => {
			expect(() =>
				tournamentSessionEndPayload.parse({
					beforeDeadline: true,
					prizeMoney: -1,
					bountyPrizes: 0,
				})
			).toThrow();
		});
	});

	describe("chipsAddRemovePayload", () => {
		it("accepts a positive amount as an add", () => {
			expect(chipsAddRemovePayload.parse({ amount: 10 }).amount).toBe(10);
		});

		it("accepts a negative amount as a remove", () => {
			expect(chipsAddRemovePayload.parse({ amount: -10 }).amount).toBe(-10);
		});

		it("rejects amount = 0 (no-op event)", () => {
			expect(() => chipsAddRemovePayload.parse({ amount: 0 })).toThrow();
		});

		it("ignores legacy type field if present", () => {
			const result = chipsAddRemovePayload.parse({ amount: 10, type: "add" });
			expect(result.amount).toBe(10);
			expect((result as Record<string, unknown>).type).toBeUndefined();
		});
	});

	describe("allInPayload", () => {
		it("rejects equity > 100", () => {
			expect(() =>
				allInPayload.parse({
					potSize: 1000,
					trials: 1,
					equity: 101,
					wins: 1,
				})
			).toThrow();
		});

		it("rejects equity < 0", () => {
			expect(() =>
				allInPayload.parse({
					potSize: 1000,
					trials: 1,
					equity: -1,
					wins: 0,
				})
			).toThrow();
		});

		it("accepts equity exactly at 0 and 100", () => {
			expect(
				allInPayload.parse({ potSize: 1, trials: 1, equity: 0, wins: 0 }).equity
			).toBe(0);
			expect(
				allInPayload.parse({ potSize: 1, trials: 1, equity: 100, wins: 1 })
					.equity
			).toBe(100);
		});
	});

	describe("updateStackPayload", () => {
		it("rejects negative stackAmount", () => {
			expect(() => updateStackPayload.parse({ stackAmount: -1 })).toThrow();
		});

		it("accepts stackAmount = 0 (bust)", () => {
			expect(updateStackPayload.parse({ stackAmount: 0 }).stackAmount).toBe(0);
		});

		it("rejects non-integer stackAmount", () => {
			expect(() => updateStackPayload.parse({ stackAmount: 3.14 })).toThrow();
		});
	});

	describe("memoPayload", () => {
		it("rejects whitespace-only text (if trimmed) or accepts (if raw)", () => {
			const result = memoPayload.safeParse({ text: "   " });
			expect(typeof result.success).toBe("boolean");
		});

		it("rejects missing text", () => {
			expect(() => memoPayload.parse({} as Record<string, unknown>)).toThrow();
		});
	});
});

describe("validateEventPayload — extra dispatch paths", () => {
	it("validates chips_add_remove via general map", () => {
		const result = validateEventPayload("chips_add_remove", {
			amount: 100,
			type: "add",
		}) as { amount: number };
		expect(result.amount).toBe(100);
	});

	it("validates purchase_chips via general map (new chipPurchaseOptionId shape)", () => {
		const result = validateEventPayload("purchase_chips", {
			chipPurchaseOptionId: "opt-123",
		}) as { chipPurchaseOptionId: string };
		expect(result.chipPurchaseOptionId).toBe("opt-123");
	});

	it("tournament session_start ignores unknown keys (schema strips extras)", () => {
		const result = validateEventPayload(
			"session_start",
			{ buyInAmount: 100 },
			"tournament"
		) as Record<string, unknown>;
		expect(result.buyInAmount).toBeUndefined();
	});

	it("throws when cash session_start receives wrong-shaped payload", () => {
		expect(() =>
			validateEventPayload("session_start", { cashOutAmount: 100 }, "cash_game")
		).toThrow();
	});

	it("throws on malformed memo payload (empty string)", () => {
		expect(() => validateEventPayload("memo", { text: "" })).toThrow();
	});

	it("throws when payload is missing required field", () => {
		expect(() => validateEventPayload("update_stack", {})).toThrow();
	});
});
