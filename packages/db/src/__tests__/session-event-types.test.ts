import { describe, expect, it } from "vitest";
import {
	ALL_EVENT_TYPES,
	allInSchema,
	COMMON_EVENT_TYPES,
	GENERIC_EVENT_TYPES,
	isValidEventTypeForSessionType,
	LIFECYCLE_EVENT_TYPES,
	MANUAL_CREATE_BLOCKED_EVENT_TYPES,
	SESSION_STATUSES,
	stackRecordPayload,
	TOURNAMENT_EVENT_TYPES,
	validateEventPayload,
} from "../constants/session-event-types";

describe("SESSION_STATUSES", () => {
	it("contains only active and completed", () => {
		expect(SESSION_STATUSES).toEqual(["active", "completed"]);
	});
});

describe("GENERIC_EVENT_TYPES", () => {
	it("contains chip_add and stack_record", () => {
		expect(GENERIC_EVENT_TYPES).toContain("chip_add");
		expect(GENERIC_EVENT_TYPES).toContain("stack_record");
	});
});

describe("ALL_EVENT_TYPES", () => {
	it("includes generic, tournament, common, and lifecycle types", () => {
		for (const t of GENERIC_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
		for (const t of TOURNAMENT_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
		for (const t of COMMON_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
		for (const t of LIFECYCLE_EVENT_TYPES) {
			expect(ALL_EVENT_TYPES).toContain(t);
		}
	});

	it("does not include old cash game event types", () => {
		const allTypes = [...ALL_EVENT_TYPES] as string[];
		expect(allTypes).not.toContain("cash_game_buy_in");
		expect(allTypes).not.toContain("cash_game_stack_record");
		expect(allTypes).not.toContain("cash_out");
	});
});

describe("MANUAL_CREATE_BLOCKED_EVENT_TYPES", () => {
	it("contains session_start and session_end", () => {
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toContain("session_start");
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).toContain("session_end");
	});

	it("does not block chip_add or stack_record", () => {
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).not.toContain("chip_add");
		expect(MANUAL_CREATE_BLOCKED_EVENT_TYPES).not.toContain("stack_record");
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
});

describe("stackRecordPayload", () => {
	it("has stackAmount and allIns (no addon)", () => {
		const result = stackRecordPayload.parse({
			stackAmount: 5000,
			allIns: [{ potSize: 2000, trials: 1, equity: 70, wins: 1 }],
		});
		expect(result.stackAmount).toBe(5000);
		expect(result.allIns[0]?.potSize).toBe(2000);
		expect("addon" in result).toBe(false);
	});
});

describe("isValidEventTypeForSessionType", () => {
	it("allows generic events for both session types", () => {
		expect(isValidEventTypeForSessionType("chip_add", "cash_game")).toBe(true);
		expect(isValidEventTypeForSessionType("stack_record", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("chip_add", "tournament")).toBe(true);
		expect(isValidEventTypeForSessionType("stack_record", "tournament")).toBe(
			true
		);
	});

	it("allows lifecycle events for both session types", () => {
		expect(isValidEventTypeForSessionType("session_start", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("session_end", "tournament")).toBe(
			true
		);
	});

	it("allows common events for both session types", () => {
		expect(isValidEventTypeForSessionType("player_join", "cash_game")).toBe(
			true
		);
		expect(isValidEventTypeForSessionType("player_join", "tournament")).toBe(
			true
		);
	});

	it("allows tournament events only for tournament", () => {
		expect(
			isValidEventTypeForSessionType("tournament_result", "tournament")
		).toBe(true);
		expect(
			isValidEventTypeForSessionType("tournament_result", "cash_game")
		).toBe(false);
	});
});

describe("validateEventPayload", () => {
	it("validates stack_record payload", () => {
		const result = validateEventPayload("stack_record", {
			stackAmount: 3000,
			allIns: [{ potSize: 1000, trials: 1, equity: 55, wins: 0 }],
		});
		expect(result).toBeDefined();
	});

	it("validates chip_add payload", () => {
		const result = validateEventPayload("chip_add", { amount: 10_000 });
		expect(result).toBeDefined();
	});
});
