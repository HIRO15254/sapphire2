import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildDefaults,
	cashOverriddenFields,
	cashSessionFormSchema,
	getTodayDateString,
	liveCashSessionFormSchema,
	NONE_VALUE,
	numStrOrEmpty,
	parseOptInt,
	sessionFormSchema,
	tournamentOverriddenFields,
	tournamentSessionFormSchema,
} from "@/features/sessions/utils/session-form-helpers";

const NUMERIC_FIELDS = [
	"breakMinutes",
	"buyIn",
	"cashOut",
	"evCashOut",
	"blind1",
	"blind2",
	"blind3",
	"ante",
	"tableSize",
	"minBuyIn",
	"maxBuyIn",
	"tournamentBuyIn",
	"entryFee",
	"startingStack",
	"bountyAmount",
	"placement",
	"totalEntries",
	"prizeMoney",
	"bountyPrizes",
] as const;
const INVALID_NUMERIC_VALUES = ["-1", "1.5"] as const;

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

	it("rejects decimal strings instead of truncating them", () => {
		expect(parseOptInt("3.7")).toBeUndefined();
	});

	it.each([
		"12abc",
		"Infinity",
		"9007199254740992",
	])("rejects unsafe or partially numeric input: %s", (value) => {
		expect(parseOptInt(value)).toBeUndefined();
	});

	it("trims surrounding whitespace around an integer", () => {
		expect(parseOptInt(" 42 ")).toBe(42);
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
			buyIn: "100",
			cashOut: "100",
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
			tournamentBuyIn: "100",
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

	it.each(
		NUMERIC_FIELDS.flatMap((field) =>
			INVALID_NUMERIC_VALUES.map((value) => [field, value] as const)
		)
	)("rejects a negative or fractional %s (%s)", (field, value) => {
		expect(
			sessionFormSchema.safeParse(validPayload({ [field]: value })).success
		).toBe(false);
	});

	it.each([
		["tournamentBuyIn", cashSessionFormSchema],
		["cashOut", liveCashSessionFormSchema],
		["buyIn", tournamentSessionFormSchema],
		["cashOut", tournamentSessionFormSchema],
	])("still rejects a negative or fractional %s once the override makes it optional", (field, schema) => {
		for (const value of INVALID_NUMERIC_VALUES) {
			expect(schema.safeParse(validPayload({ [field]: value })).success).toBe(
				false
			);
		}
	});

	it.each([
		"buyIn",
		"cashOut",
		"tournamentBuyIn",
	])("rejects an empty required %s", (field) => {
		expect(
			sessionFormSchema.safeParse(validPayload({ [field]: "" })).success
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

	it.each([
		["", true],
		["2", true],
		["10", true],
		["1", false],
		["11", false],
	])("treats a table size of %j as valid: %s", (value, accepted) => {
		expect(
			sessionFormSchema.safeParse(validPayload({ tableSize: value })).success
		).toBe(accepted);
	});
});

describe("liveCashSessionFormSchema", () => {
	function livePayload(overrides: Record<string, unknown> = {}) {
		return {
			sessionDate: "2026-04-01",
			startTime: "",
			endTime: "",
			breakMinutes: "",
			memo: "",
			ruleName: "",
			buyIn: "100",
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

	it("accepts a live cash payload with an empty cash-out (session not ended yet)", () => {
		expect(liveCashSessionFormSchema.safeParse(livePayload()).success).toBe(
			true
		);
	});

	it("still requires the initial buy-in", () => {
		expect(
			liveCashSessionFormSchema.safeParse(livePayload({ buyIn: "" })).success
		).toBe(false);
	});

	it("still requires a session date", () => {
		expect(
			liveCashSessionFormSchema.safeParse(livePayload({ sessionDate: "" }))
				.success
		).toBe(false);
	});

	it("diverges from cashSessionFormSchema, which requires the cash-out", () => {
		const payload = livePayload();
		expect(cashSessionFormSchema.safeParse(payload).success).toBe(false);
		expect(liveCashSessionFormSchema.safeParse(payload).success).toBe(true);
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

	it("seeds today's date and the empty form when no override is provided", () => {
		expect(buildDefaults(undefined)).toEqual({
			sessionDate: "2026-04-05",
			startTime: "",
			endTime: "",
			breakMinutes: "",
			memo: "",
			ruleName: "",
			buyIn: "",
			cashOut: "",
			evCashOut: "",
			variant: "NL Hold'em",
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
		});
	});

	it("propagates the free-text defaults memo, ruleName and timerStartedAt", () => {
		expect(
			buildDefaults({
				memo: "Deep stack night",
				ruleName: "1/2 NLH",
				timerStartedAt: "2026-04-05T10:00:00.000Z",
			})
		).toMatchObject({
			memo: "Deep stack night",
			ruleName: "1/2 NLH",
			timerStartedAt: "2026-04-05T10:00:00.000Z",
		});
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

	it("lists every label in form order when every field diverges", () => {
		const values = buildDefaults({
			ruleName: "Deep 1/2",
			variant: "plo",
			blind1: 2,
			blind2: 5,
			blind3: 10,
			ante: 1,
			anteType: "bb",
			minBuyIn: 200,
			maxBuyIn: 1000,
			tableSize: 6,
		});
		expect(cashOverriddenFields(values, MASTER)).toEqual([
			"Rule name",
			"Variant",
			"SB",
			"BB",
			"Straddle",
			"Ante",
			"Ante type",
			"Min buy-in",
			"Max buy-in",
			"Table size",
		]);
	});

	it("matches a master with null optional fields against the blank form values", () => {
		const values = buildDefaults({
			ruleName: "Open 1/2",
			variant: "nlh",
			blind1: 1,
			blind2: 2,
		});
		expect(
			cashOverriddenFields(values, {
				id: "rg2",
				name: "Open 1/2",
				variant: "nlh",
				blind1: 1,
				blind2: 2,
				blind3: null,
				ante: null,
				anteType: null,
				minBuyIn: null,
				maxBuyIn: null,
				tableSize: null,
			})
		).toEqual([]);
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

	it("returns [] when every rule field matches the master", () => {
		const values = buildDefaults({
			ruleName: "Main Event",
			variant: "nlh",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			tableSize: 9,
		});
		expect(tournamentOverriddenFields(values, MASTER)).toEqual([]);
	});

	it("lists every label in form order when every field diverges", () => {
		const values = buildDefaults({
			ruleName: "Side Event",
			variant: "plo",
			tournamentBuyIn: 5000,
			entryFee: 500,
			startingStack: 30_000,
			bountyAmount: 1000,
			tableSize: 8,
		});
		expect(tournamentOverriddenFields(values, MASTER)).toEqual([
			"Rule name",
			"Variant",
			"Buy-in",
			"Entry fee",
			"Starting stack",
			"Bounty amount",
			"Table size",
		]);
	});

	it("matches a master with null optional fields against the blank form values", () => {
		const values = buildDefaults({ ruleName: "Freeroll", variant: "nlh" });
		expect(
			tournamentOverriddenFields(values, {
				id: "t2",
				name: "Freeroll",
				variant: "nlh",
				buyIn: null,
				entryFee: null,
				startingStack: null,
				bountyAmount: null,
				tableSize: null,
			})
		).toEqual([]);
	});
});
