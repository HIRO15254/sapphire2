import { describe, expect, it } from "vitest";
import {
	ALL_EVENT_TYPES,
	allInSchema,
	CASH_GAME_EVENT_TYPES,
	COMMON_EVENT_TYPES,
	cashGameStackRecordPayload,
	isValidEventTypeForSessionType,
	MANUAL_CREATE_BLOCKED_EVENT_TYPES,
	SESSION_STATUSES,
	TOURNAMENT_EVENT_TYPES,
	validateEventPayload,
} from "../constants/session-event-types";

describe("SESSION_STATUSES", () => {
	it("contains only active and completed", () => {
		expect(SESSION_STATUSES).toEqual(["active", "completed"]);
		expect(SESSION_STATUSES).not.toContain("paused");
	});
});

describe("COMMON_EVENT_TYPES", () => {
	it("does not contain session_pause or session_resume", () => {
		const commonTypes = [...COMMON_EVENT_TYPES] as string[];
		expect(commonTypes).not.toContain("session_pause");
		expect(commonTypes).not.toContain("session_resume");
	});

	it("contains player_join and player_leave", () => {
		expect(COMMON_EVENT_TYPES).toContain("player_join");
		expect(COMMON_EVENT_TYPES).toContain("player_leave");
	});
});

describe("ALL_EVENT_TYPES", () => {
	it("includes all cash game, tournament, and common types", () => {
		for (const t of CASH_GAME_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
		for (const t of TOURNAMENT_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
		for (const t of COMMON_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("does not include session_pause or session_resume", () => {
		const allTypes = [...ALL_EVENT_TYPES] as string[];
		expect(allTypes).not.toContain("session_pause");
		expect(allTypes).not.toContain("session_resume");
	});
});

describe("MANUAL_CREATE_BLOCKED_EVENT_TYPES", () => {
	it("contains cash_game_buy_in", () => {
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toContain("cash_game_buy_in");
	});
});

describe("allInSchema", () => {
	it("accepts valid potSize/trials/equity/wins", () => {
		const result = allInSchema.parse({
			potSize: 500,
			trials: 1,
			equity: 65.5,
			wins: 1,
		});
		expect(result.potSize).toBe(500);
		expect(result.trials).toBe(1);
		expect(result.equity).toBe(65.5);
		expect(result.wins).toBe(1);
	});

	it("accepts decimal wins for chop scenarios", () => {
		const result = allInSchema.parse({
			potSize: 1000,
			trials: 2,
			equity: 50,
			wins: 1.5,
		});
		expect(result.wins).toBe(1.5);
	});

	it("rejects negative potSize", () => {
		expect(() =>
			allInSchema.parse({ potSize: -1, trials: 1, equity: 50, wins: 1 })
		).toThrow();
	});

	it("rejects trials less than 1", () => {
		expect(() =>
			allInSchema.parse({ potSize: 500, trials: 0, equity: 50, wins: 1 })
		).toThrow();
	});

	it("rejects equity above 100", () => {
		expect(() =>
			allInSchema.parse({ potSize: 500, trials: 1, equity: 101, wins: 1 })
		).toThrow();
	});

	it("rejects equity below 0", () => {
		expect(() =>
			allInSchema.parse({ potSize: 500, trials: 1, equity: -1, wins: 1 })
		).toThrow();
	});

	it("does not have actualResult or evResult fields", () => {
		const fields = Object.keys(allInSchema.shape);
		expect(fields).not.toContain("actualResult");
		expect(fields).not.toContain("evResult");
	});
});

describe("cashGameStackRecordPayload", () => {
	it("uses new allIn format with potSize/trials/equity/wins", () => {
		const result = cashGameStackRecordPayload.parse({
			stackAmount: 5000,
			allIns: [{ potSize: 2000, trials: 1, equity: 70, wins: 1 }],
			addon: null,
		});
		expect(result.allIns[0]?.potSize).toBe(2000);
		expect(result.allIns[0]?.equity).toBe(70);
	});
});

describe("isValidEventTypeForSessionType", () => {
	it("allows cash game events for cash_game session", () => {
		expect(
			isValidEventTypeForSessionType("cash_game_buy_in", "cash_game")
		).toBe(true);
		expect(
			isValidEventTypeForSessionType("cash_game_stack_record", "cash_game")
		).toBe(true);
		expect(isValidEventTypeForSessionType("cash_out", "cash_game")).toBe(true);
	});

	it("disallows cash game events for tournament session", () => {
		expect(
			isValidEventTypeForSessionType("cash_game_buy_in", "tournament")
		).toBe(false);
		expect(isValidEventTypeForSessionType("cash_out", "tournament")).toBe(
			false
		);
	});

	it("allows common events for both session types", () => {
		expect(isValidEventTypeForSessionType("player_join", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("player_join", "tournament")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("player_leave", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("player_leave", "tournament")).toBe(
			true
		);
	});
});

describe("validateEventPayload", () => {
	it("validates cash_game_stack_record with new allIn format", () => {
		const result = validateEventPayload("cash_game_stack_record", {
			stackAmount: 3000,
			allIns: [{ potSize: 1000, trials: 1, equity: 55, wins: 0 }],
			addon: null,
		});
		expect(result).toBeDefined();
	});
});
