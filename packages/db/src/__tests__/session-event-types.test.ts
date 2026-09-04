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
	MAX_SEAT_POSITION,
	memoPayload,
	PAUSE_RESUME_EVENT_TYPES,
	playerJoinPayload,
	playerLeavePayload,
	purchaseChipsPayload,
	TOURNAMENT_EVENT_TYPES,
	tournamentSessionEndPayload,
	tournamentSessionStartPayload,
	updateStackPayload,
	validateEventPayload,
} from "../constants/session-event-types";

describe("payload schemas", () => {
	describe("cashSessionStartPayload", () => {
		it.each([
			[100, true],
			[0, true],
			[-1, false],
			[1.5, false],
		])("buyInAmount=%p is valid=%p", (buyInAmount, valid) => {
			if (valid) {
				expect(cashSessionStartPayload.parse({ buyInAmount }).buyInAmount).toBe(
					buyInAmount
				);
			} else {
				expect(() => cashSessionStartPayload.parse({ buyInAmount })).toThrow();
			}
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
		it.each([
			[500, true],
			[0, true],
			[-5, false],
			[10.1, false],
		])("cashOutAmount=%p is valid=%p", (cashOutAmount, valid) => {
			if (valid) {
				expect(
					cashSessionEndPayload.parse({ cashOutAmount }).cashOutAmount
				).toBe(cashOutAmount);
			} else {
				expect(() => cashSessionEndPayload.parse({ cashOutAmount })).toThrow();
			}
		});
	});

	describe("tournamentSessionEndPayload", () => {
		const finishedBranch = {
			beforeDeadline: false,
			placement: 3,
			totalEntries: 10,
			prizeMoney: 0,
		} as const;
		const earlyBranch = { beforeDeadline: true, prizeMoney: 0 } as const;

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

		it.each([
			["false", finishedBranch],
			["true", earlyBranch],
		])("accepts positive bountyPrizes on the beforeDeadline=%s branch", (_, branch) => {
			expect(
				tournamentSessionEndPayload.parse({ ...branch, bountyPrizes: 250 })
			).toEqual({ ...branch, bountyPrizes: 250 });
		});

		it.each([
			["false", finishedBranch],
			["true", earlyBranch],
		])("rejects negative bountyPrizes on the beforeDeadline=%s branch", (_, branch) => {
			const result = tournamentSessionEndPayload.safeParse({
				...branch,
				bountyPrizes: -1,
			});
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.path).toEqual(["bountyPrizes"]);
		});

		it.each([
			["placement", { ...finishedBranch, placement: 0, bountyPrizes: 0 }],
			["totalEntries", { ...finishedBranch, totalEntries: 0, bountyPrizes: 0 }],
			["prizeMoney", { ...earlyBranch, prizeMoney: -1, bountyPrizes: 0 }],
		])("rejects an invalid %s", (_, payload) => {
			expect(() => tournamentSessionEndPayload.parse(payload)).toThrow();
		});

		it("reports placement > totalEntries on the placement path with its message", () => {
			const result = tournamentSessionEndPayload.safeParse({
				...finishedBranch,
				placement: 11,
				bountyPrizes: 0,
			});
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.path).toEqual(["placement"]);
			expect(result.error?.issues[0]?.message).toBe(
				"Placement must be less than or equal to total entries"
			);
		});
	});

	describe("chipsAddRemovePayload", () => {
		it.each([
			[100, true],
			[-50, true],
			[0, false],
			[1.5, false],
		])("amount=%p is valid=%p", (amount, valid) => {
			if (valid) {
				expect(chipsAddRemovePayload.parse({ amount }).amount).toBe(amount);
			} else {
				expect(() => chipsAddRemovePayload.parse({ amount })).toThrow();
			}
		});

		it("reports a zero amount with the non-zero message", () => {
			const result = chipsAddRemovePayload.safeParse({ amount: 0 });
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.message).toBe("amount must be non-zero");
		});

		it("ignores legacy type field if present", () => {
			const result = chipsAddRemovePayload.parse({ amount: 10, type: "add" });
			expect(result.amount).toBe(10);
			expect((result as Record<string, unknown>).type).toBeUndefined();
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

		it.each([
			[0, true],
			[1, true],
			[1000, true],
			[-1, false],
			[0.5, false],
			[Number.NaN, false],
			[Number.POSITIVE_INFINITY, false],
			[Number.NEGATIVE_INFINITY, false],
		])("potSize=%p is valid=%p", (potSize, valid) => {
			if (valid) {
				expect(
					allInPayload.parse({ potSize, trials: 1, equity: 50, wins: 0 })
						.potSize
				).toBe(potSize);
			} else {
				expect(() =>
					allInPayload.parse({ potSize, trials: 1, equity: 50, wins: 0 })
				).toThrow();
			}
		});

		it.each([
			[0, true],
			[100, true],
			[-1, false],
			[101, false],
		])("equity=%p is valid=%p", (equity, valid) => {
			if (valid) {
				expect(
					allInPayload.parse({ potSize: 1, trials: 1, equity, wins: 0 }).equity
				).toBe(equity);
			} else {
				expect(() =>
					allInPayload.parse({ potSize: 1, trials: 1, equity, wins: 0 })
				).toThrow();
			}
		});

		it.each([
			[0, 1, true],
			[1, 1, true],
			[1, 3, true],
			[3, 3, true],
			[1.5, 3, true],
			[2, 1, false],
			[4, 3, false],
			[1.5, 1, false],
			[-1, 3, false],
		])("wins=%p with trials=%p is valid=%p", (wins, trials, valid) => {
			const result = allInPayload.safeParse({
				potSize: 1000,
				trials,
				equity: 50,
				wins,
			});
			expect(result.success).toBe(valid);
		});

		it("reports wins > trials on the wins path with its message", () => {
			const result = allInPayload.safeParse({
				potSize: 1000,
				trials: 2,
				equity: 50,
				wins: 3,
			});
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.path).toEqual(["wins"]);
			expect(result.error?.issues[0]?.message).toBe(
				"wins must not exceed trials"
			);
		});
	});

	describe("purchaseChipsPayload", () => {
		it("accepts valid sessionChipPurchaseId, name, cost, chips", () => {
			const result = purchaseChipsPayload.parse({
				sessionChipPurchaseId: "scp-1",
				name: "Rebuy",
				cost: 100,
				chips: 5000,
			});
			expect(result.sessionChipPurchaseId).toBe("scp-1");
			expect(result.name).toBe("Rebuy");
			expect(result.chips).toBe(5000);
		});

		it.each([
			["cost", { cost: -1, chips: 100 }],
			["chips", { cost: 1, chips: -1 }],
		])("rejects a negative %s", (_, overrides) => {
			expect(() =>
				purchaseChipsPayload.parse({
					sessionChipPurchaseId: "scp-1",
					name: "Rebuy",
					...overrides,
				})
			).toThrow();
		});

		it("rejects empty sessionChipPurchaseId", () => {
			expect(() =>
				purchaseChipsPayload.parse({
					sessionChipPurchaseId: "",
					name: "Rebuy",
					cost: 1,
					chips: 1,
				})
			).toThrow();
		});

		it("rejects empty name", () => {
			expect(() =>
				purchaseChipsPayload.parse({
					sessionChipPurchaseId: "scp-1",
					name: "",
					cost: 1,
					chips: 1,
				})
			).toThrow();
		});
	});

	describe("updateStackPayload", () => {
		it.each([
			[5000, true],
			[0, true],
			[-1, false],
			[3.14, false],
		])("stackAmount=%p is valid=%p", (stackAmount, valid) => {
			if (valid) {
				expect(updateStackPayload.parse({ stackAmount }).stackAmount).toBe(
					stackAmount
				);
			} else {
				expect(() => updateStackPayload.parse({ stackAmount })).toThrow();
			}
		});

		it("accepts optional tournament-info fields", () => {
			const result = updateStackPayload.parse({
				stackAmount: 5000,
				remainingPlayers: 30,
				totalEntries: 100,
				chipPurchaseCounts: [{ name: "Rebuy", count: 1, chipsPerUnit: 10_000 }],
			});
			expect(result.remainingPlayers).toBe(30);
			expect(result.totalEntries).toBe(100);
			expect(result.chipPurchaseCounts).toHaveLength(1);
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

		it.each([
			["missing name", { count: 1, chipsPerUnit: 1 }, "name"],
			["missing count", { name: "Rebuy", chipsPerUnit: 1 }, "count"],
			["empty name", { name: "", count: 1, chipsPerUnit: 1 }, "name"],
			[
				"negative count",
				{ name: "Rebuy", count: -1, chipsPerUnit: 1 },
				"count",
			],
			[
				"negative chipsPerUnit",
				{ name: "Rebuy", count: 1, chipsPerUnit: -1 },
				"chipsPerUnit",
			],
		])("rejects a chipPurchaseCounts entry with %s", (_, entry, offendingField) => {
			const result = updateStackPayload.safeParse({
				stackAmount: 5000,
				chipPurchaseCounts: [entry],
			});
			expect(result.success).toBe(false);
			expect(result.error?.issues[0]?.path).toEqual([
				"chipPurchaseCounts",
				0,
				offendingField,
			]);
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

		it("accepts whitespace-only text (memo is not trimmed)", () => {
			expect(memoPayload.parse({ text: "   " })).toEqual({ text: "   " });
		});
	});

	describe("playerJoinPayload", () => {
		it("accepts valid playerId", () => {
			const result = playerJoinPayload.parse({ playerId: "player-1" });
			expect(result.playerId).toBe("player-1");
		});

		it("defaults isHero to false when omitted", () => {
			expect(playerJoinPayload.parse({ playerId: "player-1" })).toEqual({
				playerId: "player-1",
				isHero: false,
			});
		});

		it("rejects empty playerId", () => {
			expect(() => playerJoinPayload.parse({ playerId: "" })).toThrow();
		});

		it("accepts seatPosition 0 (lower boundary)", () => {
			const result = playerJoinPayload.parse({
				playerId: "player-1",
				seatPosition: 0,
			});
			expect(result.seatPosition).toBe(0);
		});

		it("accepts seatPosition 8 (mid boundary)", () => {
			const result = playerJoinPayload.parse({
				playerId: "player-1",
				seatPosition: 8,
			});
			expect(result.seatPosition).toBe(8);
		});

		it("accepts seatPosition 9 (last seat of a 10-max table)", () => {
			const result = playerJoinPayload.parse({
				playerId: "player-1",
				seatPosition: 9,
			});
			expect(result.seatPosition).toBe(9);
		});

		it("rejects seatPosition 10 (beyond a 10-max table)", () => {
			expect(() =>
				playerJoinPayload.parse({ playerId: "player-1", seatPosition: 10 })
			).toThrow();
		});

		it("rejects negative seatPosition", () => {
			expect(() =>
				playerJoinPayload.parse({ playerId: "player-1", seatPosition: -1 })
			).toThrow();
		});

		it("rejects non-integer seatPosition", () => {
			expect(() =>
				playerJoinPayload.parse({ playerId: "player-1", seatPosition: 1.5 })
			).toThrow();
		});
	});

	describe("MAX_SEAT_POSITION", () => {
		it("bounds playerJoinPayload's seatPosition upper limit", () => {
			expect(() =>
				playerJoinPayload.parse({
					playerId: "player-1",
					seatPosition: MAX_SEAT_POSITION + 1,
				})
			).toThrow();
			const result = playerJoinPayload.parse({
				playerId: "player-1",
				seatPosition: MAX_SEAT_POSITION,
			});
			expect(result.seatPosition).toBe(MAX_SEAT_POSITION);
		});
	});

	describe("playerLeavePayload", () => {
		it("accepts valid playerId", () => {
			const result = playerLeavePayload.parse({ playerId: "player-1" });
			expect(result.playerId).toBe("player-1");
		});

		it("defaults isHero to false when omitted", () => {
			expect(playerLeavePayload.parse({ playerId: "player-1" })).toEqual({
				playerId: "player-1",
				isHero: false,
			});
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

	it("returns false for a cash/tournament-only event type paired with an unknown session type", () => {
		expect(
			isValidEventTypeForSessionType(
				"chips_add_remove",
				"unknown" as unknown as "cash_game" | "tournament"
			)
		).toBe(false);
	});
});

describe("validateEventPayload", () => {
	it("dispatches session_start to cash schema for cash_game", () => {
		expect(
			validateEventPayload("session_start", { buyInAmount: 500 }, "cash_game")
		).toEqual({ buyInAmount: 500 });
	});

	it("dispatches session_start to tournament schema carrying timerStartedAt", () => {
		expect(
			validateEventPayload(
				"session_start",
				{ timerStartedAt: 1_700_000_000 },
				"tournament"
			)
		).toEqual({ timerStartedAt: 1_700_000_000 });
	});

	it("dispatches session_start for tournament with missing timerStartedAt", () => {
		expect(validateEventPayload("session_start", {}, "tournament")).toEqual({});
	});

	it("dispatches session_end to cash schema for cash_game", () => {
		expect(
			validateEventPayload("session_end", { cashOutAmount: 1000 }, "cash_game")
		).toEqual({ cashOutAmount: 1000 });
	});

	it("dispatches session_end to tournament schema for tournament", () => {
		expect(
			validateEventPayload(
				"session_end",
				{ beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 },
				"tournament"
			)
		).toEqual({ beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 });
	});

	it("dispatches non-lifecycle events using general schema map", () => {
		expect(validateEventPayload("memo", { text: "nice bluff" })).toEqual({
			text: "nice bluff",
		});
	});

	it("defaults session_start to the tournament schema when sessionType is omitted", () => {
		expect(validateEventPayload("session_start", {})).toEqual({});
	});

	it("defaults session_end to the tournament schema when sessionType is omitted", () => {
		expect(
			validateEventPayload("session_end", {
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			})
		).toEqual({ beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 });
	});

	it("tournament session_start ignores unknown keys (schema strips extras)", () => {
		const result = validateEventPayload(
			"session_start",
			{ buyInAmount: 100 },
			"tournament"
		) as { buyInAmount?: number };
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
});

describe("getSessionCurrentState", () => {
	const makeEvent = (eventType: string, offsetMs = 0) => ({
		eventType,
		occurredAt: new Date(1_000_000 + offsetMs),
		sortOrder: offsetMs,
	});

	it('returns "active" for an empty event list', () => {
		expect(getSessionCurrentState([])).toBe("active");
	});

	it('returns "active" when only non-lifecycle events exist', () => {
		expect(getSessionCurrentState([makeEvent("update_stack", 0)])).toBe(
			"active"
		);
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

	it("ignores a later non-lifecycle event when picking the latest state", () => {
		const events = [makeEvent("session_pause", 1000), makeEvent("memo", 2000)];
		expect(getSessionCurrentState(events)).toBe("paused");
	});

	it("treats a later session_start as a state event that clears a pause", () => {
		const events = [
			makeEvent("session_pause", 1000),
			makeEvent("session_start", 2000),
		];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it("prefers the later occurredAt over a higher sortOrder", () => {
		const events = [
			{
				eventType: "session_pause",
				occurredAt: new Date(2000),
				sortOrder: 0,
			},
			{
				eventType: "session_resume",
				occurredAt: new Date(1000),
				sortOrder: 5,
			},
		];
		expect(getSessionCurrentState(events)).toBe("paused");
	});

	it("prefers the higher sortOrder at equal occurredAt (pause later)", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ eventType: "session_resume", occurredAt, sortOrder: 1 },
			{ eventType: "session_pause", occurredAt, sortOrder: 2 },
		];
		expect(getSessionCurrentState(events)).toBe("paused");
	});

	it("prefers the higher sortOrder at equal occurredAt (resume later)", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ eventType: "session_pause", occurredAt, sortOrder: 1 },
			{ eventType: "session_resume", occurredAt, sortOrder: 2 },
		];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it("uses id as the deterministic final tie-breaker", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ id: "a-resume", eventType: "session_resume", occurredAt, sortOrder: 1 },
			{ id: "z-pause", eventType: "session_pause", occurredAt, sortOrder: 1 },
		];
		expect(getSessionCurrentState(events)).toBe("paused");
	});

	it("uses id as the final tie-breaker in the other direction", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ id: "a-pause", eventType: "session_pause", occurredAt, sortOrder: 1 },
			{ id: "z-resume", eventType: "session_resume", occurredAt, sortOrder: 1 },
		];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it("sorts an event without id below any event with an id (resume with id wins)", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ eventType: "session_pause", occurredAt, sortOrder: 1 },
			{ id: "a-resume", eventType: "session_resume", occurredAt, sortOrder: 1 },
		];
		expect(getSessionCurrentState(events)).toBe("active");
	});

	it("sorts an event without id below any event with an id (pause with id wins)", () => {
		const occurredAt = new Date(1_000_000);
		const events = [
			{ id: "a-pause", eventType: "session_pause", occurredAt, sortOrder: 1 },
			{ eventType: "session_resume", occurredAt, sortOrder: 1 },
		];
		expect(getSessionCurrentState(events)).toBe("paused");
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

	it.each([
		"session_pause",
		"session_end",
	] as const)("active state allows %s", (eventType) => {
		expect(isEventAllowedInState(eventType, "active")).toBe(true);
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
});
