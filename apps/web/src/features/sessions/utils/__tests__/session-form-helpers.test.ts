import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildDefaults,
	cashOverriddenFields,
	getTodayDateString,
	NONE_VALUE,
	numStrOrEmpty,
	parseOptInt,
	sessionFormSchema,
	tournamentOverriddenFields,
} from "@/features/sessions/utils/session-form-helpers";

describe("NONE_VALUE", () => {
	it("is the sentinel string used by clearable selects", () => {
		expect(NONE_VALUE).toBe("__none__");
	});
});

describe("getTodayDateString", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("formats today's local date as YYYY-MM-DD", () => {
		vi.setSystemTime(new Date(2026, 3, 5, 10, 0, 0));
		expect(getTodayDateString()).toBe("2026-04-05");
	});

	it("zero-pads single-digit month and day", () => {
		vi.setSystemTime(new Date(2026, 0, 1));
		expect(getTodayDateString()).toBe("2026-01-01");
	});

	it("handles end-of-year", () => {
		vi.setSystemTime(new Date(2026, 11, 31));
		expect(getTodayDateString()).toBe("2026-12-31");
	});
});

describe("numStrOrEmpty", () => {
	it("returns empty string for undefined", () => {
		expect(numStrOrEmpty(undefined)).toBe("");
	});

	it("returns '0' for zero", () => {
		expect(numStrOrEmpty(0)).toBe("0");
	});

	it("stringifies positive numbers", () => {
		expect(numStrOrEmpty(42)).toBe("42");
	});

	it("stringifies negative numbers", () => {
		expect(numStrOrEmpty(-7)).toBe("-7");
	});
});

describe("parseOptInt", () => {
	it("returns undefined for empty string", () => {
		expect(parseOptInt("")).toBeUndefined();
	});

	it("returns parsed integer", () => {
		expect(parseOptInt("42")).toBe(42);
	});

	it("returns undefined for non-numeric", () => {
		expect(parseOptInt("abc")).toBeUndefined();
	});

	it("truncates decimal strings (parseInt semantics)", () => {
		expect(parseOptInt("3.7")).toBe(3);
	});

	it("returns 0 as 0 (finite)", () => {
		expect(parseOptInt("0")).toBe(0);
	});
});

describe("sessionFormSchema", () => {
	function validPayload(overrides: Record<string, unknown> = {}) {
		return {
			sessionDate: "2026-04-01",
			startTime: "",
			endTime: "",
			breakMinutes: "",
			memo: "",
			ruleName: "",
			buyIn: "",
			cashOut: "",
			evCashOut: "",
			variant: "nlh",
			blind1: "",
			blind2: "",
			blind3: "",
			ante: "",
			anteType: "none",
			tableSize: "",
			minBuyIn: "",
			maxBuyIn: "",
			tournamentBuyIn: "",
			entryFee: "",
			startingStack: "",
			bountyAmount: "",
			beforeDeadline: false,
			timerStartedAt: "",
			placement: "",
			totalEntries: "",
			prizeMoney: "",
			bountyPrizes: "",
			...overrides,
		};
	}

	it("accepts a minimal valid payload", () => {
		expect(sessionFormSchema.safeParse(validPayload()).success).toBe(true);
	});

	it("rejects empty sessionDate (required)", () => {
		expect(
			sessionFormSchema.safeParse(validPayload({ sessionDate: "" })).success
		).toBe(false);
	});

	it("rejects negative optional numeric values", () => {
		expect(
			sessionFormSchema.safeParse(validPayload({ buyIn: "-1" })).success
		).toBe(false);
	});

	it("enforces placement >= 1", () => {
		expect(
			sessionFormSchema.safeParse(validPayload({ placement: "0" })).success
		).toBe(false);
		expect(
			sessionFormSchema.safeParse(validPayload({ placement: "1" })).success
		).toBe(true);
	});

	it("enforces totalEntries >= 1", () => {
		expect(
			sessionFormSchema.safeParse(validPayload({ totalEntries: "0" })).success
		).toBe(false);
		expect(
			sessionFormSchema.safeParse(validPayload({ totalEntries: "1" })).success
		).toBe(true);
	});

	it("accepts numeric strings within bounds", () => {
		expect(
			sessionFormSchema.safeParse(
				validPayload({
					buyIn: "100",
					cashOut: "200",
					placement: "3",
					totalEntries: "100",
				})
			).success
		).toBe(true);
	});
});

describe("buildDefaults", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 3, 5));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("seeds today's date and sensible defaults when no override is provided", () => {
		const defaults = buildDefaults(undefined);
		expect(defaults.sessionDate).toBe("2026-04-05");
		expect(defaults.startTime).toBe("");
		expect(defaults.endTime).toBe("");
		expect(defaults.variant).toBe("NL Hold'em");
		expect(defaults.anteType).toBe("none");
		expect(defaults.tableSize).toBe("");
		expect(defaults.beforeDeadline).toBe(false);
	});

	it("converts numeric defaults through numStrOrEmpty", () => {
		const defaults = buildDefaults({ buyIn: 100, cashOut: 0, ante: undefined });
		expect(defaults.buyIn).toBe("100");
		expect(defaults.cashOut).toBe("0");
		expect(defaults.ante).toBe("");
	});

	it("propagates provided sessionDate", () => {
		expect(buildDefaults({ sessionDate: "2026-01-02" }).sessionDate).toBe(
			"2026-01-02"
		);
	});

	it("beforeDeadline is true only when explicitly true", () => {
		expect(buildDefaults({ beforeDeadline: true }).beforeDeadline).toBe(true);
		expect(buildDefaults({ beforeDeadline: false }).beforeDeadline).toBe(false);
		expect(buildDefaults({}).beforeDeadline).toBe(false);
	});

	it("tableSize is stringified when numeric", () => {
		expect(buildDefaults({ tableSize: 6 }).tableSize).toBe("6");
		expect(buildDefaults({ tableSize: undefined }).tableSize).toBe("");
	});
});

describe("cashOverriddenFields", () => {
	const MASTER = {
		id: "rg1",
		name: "1/2 NLH",
		variant: "nlh",
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		minBuyIn: 100,
		maxBuyIn: 400,
		tableSize: 9,
	};

	it("returns [] when no master is selected", () => {
		expect(cashOverriddenFields(buildDefaults({}), undefined)).toEqual([]);
	});

	it("returns [] when every rule field matches the master", () => {
		const values = buildDefaults({
			ruleName: "1/2 NLH",
			variant: "nlh",
			blind1: 1,
			blind2: 2,
			ante: undefined,
			anteType: "none",
			minBuyIn: 100,
			maxBuyIn: 400,
			tableSize: 9,
		});
		expect(cashOverriddenFields(values, MASTER)).toEqual([]);
	});

	it("lists the labels of fields that diverge from the master", () => {
		const values = buildDefaults({
			ruleName: "Deep 1/2",
			variant: "nlh",
			blind1: 1,
			blind2: 3,
			minBuyIn: 100,
			maxBuyIn: 400,
			tableSize: 9,
		});
		expect(cashOverriddenFields(values, MASTER)).toEqual(["Rule name", "BB"]);
	});
});

describe("tournamentOverriddenFields", () => {
	const MASTER = {
		id: "t1",
		name: "Main Event",
		variant: "nlh",
		buyIn: 10_000,
		entryFee: 1000,
		startingStack: 20_000,
		bountyAmount: null,
		tableSize: 9,
	};

	it("returns [] when no master is selected", () => {
		expect(tournamentOverriddenFields(buildDefaults({}), undefined)).toEqual(
			[]
		);
	});

	it("lists fields that diverge from the master", () => {
		const values = buildDefaults({
			ruleName: "Main Event",
			variant: "nlh",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
			startingStack: 30_000,
			tableSize: 9,
		});
		expect(tournamentOverriddenFields(values, MASTER)).toEqual([
			"Starting stack",
		]);
	});
});
