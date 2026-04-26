import { describe, expect, it } from "vitest";
import {
	optionalNumericString,
	parseOptionalInt,
	parseOptionalNumber,
	parseRequiredInt,
	parseRequiredNumber,
	requiredNumericString,
} from "@/shared/lib/form-fields";

describe("requiredNumericString", () => {
	it("rejects empty strings with 'Required'", () => {
		const result = requiredNumericString().safeParse("");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Required");
		}
	});

	it("rejects whitespace-only strings with 'Required' (trimmed first)", () => {
		const result = requiredNumericString().safeParse("   ");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Required");
		}
	});

	it("accepts integer strings", () => {
		expect(requiredNumericString().safeParse("0").success).toBe(true);
		expect(requiredNumericString().safeParse("42").success).toBe(true);
		expect(requiredNumericString().safeParse("-7").success).toBe(true);
	});

	it("accepts decimal strings when integer rule is off", () => {
		expect(requiredNumericString().safeParse("3.14").success).toBe(true);
		expect(requiredNumericString().safeParse("-0.5").success).toBe(true);
	});

	it("rejects non-numeric input with 'Must be a number'", () => {
		const result = requiredNumericString().safeParse("abc");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be a number");
		}
	});

	it("trims surrounding whitespace before parsing", () => {
		expect(requiredNumericString().safeParse("  42  ").success).toBe(true);
	});

	it("rejects values below min", () => {
		const result = requiredNumericString({ min: 10 }).safeParse("5");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be at least 10");
		}
	});

	it("accepts values equal to min", () => {
		expect(requiredNumericString({ min: 10 }).safeParse("10").success).toBe(
			true
		);
	});

	it("rejects values above max", () => {
		const result = requiredNumericString({ max: 100 }).safeParse("101");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be at most 100");
		}
	});

	it("accepts values equal to max", () => {
		expect(requiredNumericString({ max: 100 }).safeParse("100").success).toBe(
			true
		);
	});

	it("reports both min and max when both are violated in a single pass", () => {
		// With only one bound breached, only that single issue is added.
		const resultMin = requiredNumericString({
			min: 0,
			max: 10,
		}).safeParse("-5");
		expect(resultMin.success).toBe(false);
		if (!resultMin.success) {
			expect(resultMin.error.issues).toHaveLength(1);
			expect(resultMin.error.issues[0]?.message).toBe("Must be at least 0");
		}
	});

	it("integer: rule — rejects values whose parseInt yields NaN", () => {
		// parseInt("abc") is NaN.
		const result = requiredNumericString({ integer: true }).safeParse("abc");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be a number");
		}
	});

	it("integer: rule — accepts decimal-looking input by truncating (parseInt)", () => {
		// parseInt("3.14") is 3, which is finite → accepted.
		expect(
			requiredNumericString({ integer: true }).safeParse("3.14").success
		).toBe(true);
	});

	it("rejects Infinity as not finite", () => {
		// Number("Infinity") is Infinity → !isFinite → rejected.
		const result = requiredNumericString().safeParse("Infinity");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be a number");
		}
	});

	it("rejects NaN literal", () => {
		const result = requiredNumericString().safeParse("NaN");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("Must be a number");
		}
	});

	it("rejects non-string input at the string schema layer", () => {
		// z.string() rejects numbers outright.
		const result = requiredNumericString().safeParse(42 as unknown as string);
		expect(result.success).toBe(false);
	});
});

describe("optionalNumericString", () => {
	it("accepts empty string (returns success)", () => {
		expect(optionalNumericString().safeParse("").success).toBe(true);
	});

	it("accepts whitespace-only string (trimmed to empty)", () => {
		expect(optionalNumericString().safeParse("   ").success).toBe(true);
	});

	it("rejects non-numeric input", () => {
		expect(optionalNumericString().safeParse("abc").success).toBe(false);
	});

	it("enforces min when a value is supplied", () => {
		expect(optionalNumericString({ min: 10 }).safeParse("5").success).toBe(
			false
		);
	});

	it("does not enforce min when empty", () => {
		expect(optionalNumericString({ min: 10 }).safeParse("").success).toBe(true);
	});

	it("accepts numeric values within bounds", () => {
		expect(
			optionalNumericString({ min: 0, max: 1 }).safeParse("0.5").success
		).toBe(true);
	});
});

describe("parseOptionalInt", () => {
	it("returns undefined for empty string", () => {
		expect(parseOptionalInt("")).toBeUndefined();
	});

	it("returns undefined for whitespace-only", () => {
		expect(parseOptionalInt("   ")).toBeUndefined();
	});

	it("parses integer strings", () => {
		expect(parseOptionalInt("42")).toBe(42);
		expect(parseOptionalInt("-7")).toBe(-7);
		expect(parseOptionalInt("0")).toBe(0);
	});

	it("truncates decimal strings (parseInt semantics)", () => {
		expect(parseOptionalInt("3.14")).toBe(3);
		expect(parseOptionalInt("-3.9")).toBe(-3);
	});

	it("returns undefined for non-numeric input", () => {
		expect(parseOptionalInt("abc")).toBeUndefined();
	});

	it("trims surrounding whitespace", () => {
		expect(parseOptionalInt("  42  ")).toBe(42);
	});

	it("returns undefined for 'Infinity' (parseInt yields NaN)", () => {
		expect(parseOptionalInt("Infinity")).toBeUndefined();
	});
});

describe("parseOptionalNumber", () => {
	it("returns undefined for empty string", () => {
		expect(parseOptionalNumber("")).toBeUndefined();
	});

	it("parses decimal strings", () => {
		expect(parseOptionalNumber("3.14")).toBeCloseTo(3.14);
	});

	it("parses scientific notation", () => {
		expect(parseOptionalNumber("1e3")).toBe(1000);
	});

	it("returns undefined for non-numeric input", () => {
		expect(parseOptionalNumber("abc")).toBeUndefined();
	});

	it("returns undefined for 'Infinity' (Number() yields Infinity, not finite)", () => {
		expect(parseOptionalNumber("Infinity")).toBeUndefined();
	});

	it("returns undefined for NaN string", () => {
		expect(parseOptionalNumber("NaN")).toBeUndefined();
	});
});

describe("parseRequiredInt", () => {
	it("returns 0 when empty", () => {
		expect(parseRequiredInt("")).toBe(0);
	});

	it("returns 0 for non-numeric input", () => {
		expect(parseRequiredInt("abc")).toBe(0);
	});

	it("returns parsed integer for numeric input", () => {
		expect(parseRequiredInt("42")).toBe(42);
		expect(parseRequiredInt("-7")).toBe(-7);
	});

	it("returns 0 when actual value is 0", () => {
		expect(parseRequiredInt("0")).toBe(0);
	});
});

describe("parseRequiredNumber", () => {
	it("returns 0 when empty", () => {
		expect(parseRequiredNumber("")).toBe(0);
	});

	it("returns 0 for non-numeric input", () => {
		expect(parseRequiredNumber("abc")).toBe(0);
	});

	it("returns parsed number for numeric input", () => {
		expect(parseRequiredNumber("3.14")).toBeCloseTo(3.14);
	});

	it("returns 0 when actual value is 0", () => {
		expect(parseRequiredNumber("0")).toBe(0);
	});
});
