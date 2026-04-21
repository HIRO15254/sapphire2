import { describe, expect, it } from "vitest";
import {
	ALL_EVENT_TYPES,
	allInPayload,
	CASH_EVENT_TYPES,
	COMMON_EVENT_TYPES,
	cashSessionEndPayload,
	cashSessionStartPayload,
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
	updateTournamentInfoPayload,
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

	it("TOURNAMENT_EVENT_TYPES contains purchase_chips and update_tournament_info", () => {
		expect(TOURNAMENT_EVENT_TYPES).toContain("purchase_chips");
		expect(TOURNAMENT_EVENT_TYPES).toContain("update_tournament_info");
	});

	it("COMMON_EVENT_TYPES contains update_stack, player_join, player_leave, memo", () => {
		expect(COMMON_EVENT_TYPES).toContain("update_stack");
		expect(COMMON_EVENT_TYPES).toContain("player_join");
		expect(COMMON_EVENT_TYPES).toContain("player_leave");
		expect(COMMON_EVENT_TYPES).toContain("memo");
	});
});

describe("ALL_EVENT_TYPES", () => {
	it("includes all 12 event types", () => {
		expect(ALL_EVENT_TYPES).toHaveLength(12);
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

	describe("tournamentSessionStartPayload", () => {
		it("accepts an empty payload", () => {
			const result = tournamentSessionStartPayload.parse({});
			expect(result.timerStartedAt).toBeUndefined();
		});

		it("accepts null timerStartedAt", () => {
			const result = tournamentSessionStartPayload.parse({
				timerStartedAt: null,
			});
			expect(result.timerStartedAt).toBeNull();
		});

		it("accepts an integer timerStartedAt (unix seconds)", () => {
			const result = tournamentSessionStartPayload.parse({
				timerStartedAt: 1_700_000_000,
			});
			expect(result.timerStartedAt).toBe(1_700_000_000);
		});

		it("rejects a non-integer timerStartedAt", () => {
			expect(() =>
				tournamentSessionStartPayload.parse({ timerStartedAt: 12.5 })
			).toThrow();
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
		it('accepts valid amount with type "add"', () => {
			const result = chipsAddRemovePayload.parse({ amount: 100, type: "add" });
			expect(result.type).toBe("add");
		});

		it('accepts valid amount with type "remove"', () => {
			const result = chipsAddRemovePayload.parse({
				amount: 50,
				type: "remove",
			});
			expect(result.type).toBe("remove");
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

	describe("purchaseChipsPayload", () => {
		it("accepts valid name, cost, chips", () => {
			const result = purchaseChipsPayload.parse({
				name: "Rebuy",
				cost: 100,
				chips: 5000,
			});
			expect(result.name).toBe("Rebuy");
			expect(result.chips).toBe(5000);
		});
	});

	describe("updateTournamentInfoPayload", () => {
		it("accepts all-null values via defaults", () => {
			const result = updateTournamentInfoPayload.parse({});
			expect(result.remainingPlayers).toBeNull();
			expect(result.totalEntries).toBeNull();
			expect(result.averageStack).toBeNull();
		});
	});

	describe("updateStackPayload", () => {
		it("accepts valid stackAmount", () => {
			const result = updateStackPayload.parse({ stackAmount: 5000 });
			expect(result.stackAmount).toBe(5000);
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
	});

	describe("playerLeavePayload", () => {
		it("accepts valid playerId", () => {
			const result = playerLeavePayload.parse({ playerId: "player-1" });
			expect(result.playerId).toBe("player-1");
		});

		it("rejects empty playerId", () => {
			expect(() => playerLeavePayload.parse({ playerId: "" })).toThrow();
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
		expect(
			isValidEventTypeForSessionType("update_tournament_info", "tournament")
		).toBe(true);
	});

	it("blocks tournament event types for cash_game", () => {
		expect(isValidEventTypeForSessionType("purchase_chips", "cash_game")).toBe(
			false
		);
		expect(
			isValidEventTypeForSessionType("update_tournament_info", "cash_game")
		).toBe(false);
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

	it("dispatches session_start to tournament schema carrying timerStartedAt", () => {
		const result = validateEventPayload(
			"session_start",
			{ timerStartedAt: 1_700_000_000 },
			"tournament"
		) as { timerStartedAt?: number | null };
		expect(result.timerStartedAt).toBe(1_700_000_000);
	});

	it("dispatches session_start for tournament with missing timerStartedAt", () => {
		const result = validateEventPayload("session_start", {}, "tournament");
		expect(result).toBeDefined();
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
		expect(isEventAllowedInState("update_tournament_info", "active")).toBe(
			true
		);
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
