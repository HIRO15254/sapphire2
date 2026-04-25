import { describe, expect, it } from "vitest";
import {
	applyTimeToDate,
	toOccurredAtTimestamp,
	toTimeInputValue,
	validateOccurredAtTime,
} from "@/features/live-sessions/utils/stack-editor-time";

describe("toTimeInputValue", () => {
	it("formats Date as HH:MM", () => {
		expect(toTimeInputValue(new Date(2026, 3, 1, 9, 5))).toBe("09:05");
	});

	it("zero-pads single-digit hours and minutes", () => {
		expect(toTimeInputValue(new Date(2026, 3, 1, 0, 0))).toBe("00:00");
		expect(toTimeInputValue(new Date(2026, 3, 1, 23, 59))).toBe("23:59");
	});

	it("accepts ISO string input (same result in local timezone)", () => {
		const date = new Date(2026, 3, 1, 15, 30);
		expect(toTimeInputValue(date.toISOString())).toBe(toTimeInputValue(date));
	});
});

describe("applyTimeToDate", () => {
	it("sets hours and minutes on a clone (zeroes seconds/ms)", () => {
		const original = new Date(2026, 3, 1, 10, 20, 30, 123);
		const next = applyTimeToDate(original, "09:05");
		expect(next.getFullYear()).toBe(2026);
		expect(next.getMonth()).toBe(3);
		expect(next.getDate()).toBe(1);
		expect(next.getHours()).toBe(9);
		expect(next.getMinutes()).toBe(5);
		expect(next.getSeconds()).toBe(0);
		expect(next.getMilliseconds()).toBe(0);
	});

	it("accepts ISO string as original", () => {
		const next = applyTimeToDate("2026-04-01T00:00:00", "09:05");
		expect(next.getHours()).toBe(9);
		expect(next.getMinutes()).toBe(5);
	});

	it("treats missing time parts as 0", () => {
		const next = applyTimeToDate(new Date(2026, 3, 1), "");
		expect(next.getHours()).toBe(0);
		expect(next.getMinutes()).toBe(0);
	});

	it("produces an Invalid Date when time string is malformed (NaN parts)", () => {
		// Number("abc") -> NaN; setHours(NaN, NaN, ...) invalidates the Date.
		const next = applyTimeToDate(new Date(2026, 3, 1), "abc:def");
		expect(Number.isNaN(next.getTime())).toBe(true);
	});
});

describe("validateOccurredAtTime", () => {
	const BASE = new Date(2026, 3, 1, 12, 0);

	it("returns null when no bounds are provided", () => {
		expect(validateOccurredAtTime("09:00", BASE, null, null)).toBeNull();
	});

	it("returns null when value is within bounds", () => {
		const min = new Date(2026, 3, 1, 8, 0);
		const max = new Date(2026, 3, 1, 20, 0);
		expect(validateOccurredAtTime("12:30", BASE, min, max)).toBeNull();
	});

	it("reports 'Must be after' when before min", () => {
		const min = new Date(2026, 3, 1, 10, 0);
		expect(validateOccurredAtTime("09:00", BASE, min, null)).toBe(
			"Must be after 10:00"
		);
	});

	it("reports 'Must be before' when after max", () => {
		const max = new Date(2026, 3, 1, 15, 0);
		expect(validateOccurredAtTime("16:00", BASE, null, max)).toBe(
			"Must be before 15:00"
		);
	});

	it("equality at min is OK (min is truncated to seconds=0)", () => {
		// min has seconds → truncated to HH:MM:00; candidate "10:00" == min.
		const min = new Date(2026, 3, 1, 10, 0, 45);
		expect(validateOccurredAtTime("10:00", BASE, min, null)).toBeNull();
	});

	it("equality at max is OK", () => {
		const max = new Date(2026, 3, 1, 15, 0, 45);
		expect(validateOccurredAtTime("15:00", BASE, null, max)).toBeNull();
	});
});

describe("toOccurredAtTimestamp", () => {
	it("returns undefined when original is undefined", () => {
		expect(toOccurredAtTimestamp(undefined, "12:00")).toBeUndefined();
	});

	it("returns undefined when timeStr is empty", () => {
		expect(toOccurredAtTimestamp(new Date(), "")).toBeUndefined();
	});

	it("returns unix seconds for valid combination", () => {
		const original = new Date(2026, 3, 1);
		const expected = Math.floor(new Date(2026, 3, 1, 9, 5).getTime() / 1000);
		expect(toOccurredAtTimestamp(original, "09:05")).toBe(expected);
	});

	it("accepts ISO string as original", () => {
		const original = "2026-04-01T00:00:00";
		const result = toOccurredAtTimestamp(original, "09:05");
		expect(typeof result).toBe("number");
		expect(result).toBeGreaterThan(0);
	});
});
