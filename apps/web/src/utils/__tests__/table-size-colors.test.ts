import { describe, expect, it } from "vitest";
import {
	getTableSizeClassName,
	TABLE_SIZE_COLORS,
} from "@/utils/table-size-colors";

const COLOR_PAIR_SHAPE = /^bg-[a-z]+-100 text-[a-z]+-700 dark:bg-/;

describe("TABLE_SIZE_COLORS", () => {
	it("has entries for sizes 2 through 10", () => {
		for (const size of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
			expect(TABLE_SIZE_COLORS[size]).toBeDefined();
			expect(typeof TABLE_SIZE_COLORS[size]).toBe("string");
			expect(TABLE_SIZE_COLORS[size]).not.toBe("");
		}
	});

	it("does not include sizes outside the poker table range", () => {
		expect(TABLE_SIZE_COLORS[0]).toBeUndefined();
		expect(TABLE_SIZE_COLORS[1]).toBeUndefined();
		expect(TABLE_SIZE_COLORS[11]).toBeUndefined();
	});

	it("uses the Tailwind light+dark color pair shape", () => {
		for (const size of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
			const value = TABLE_SIZE_COLORS[size];
			expect(value).toMatch(COLOR_PAIR_SHAPE);
			expect(value).toContain("dark:text-");
		}
	});

	it("each size maps to a distinct color", () => {
		const values = [2, 3, 4, 5, 6, 7, 8, 9, 10].map(
			(size) => TABLE_SIZE_COLORS[size]
		);
		expect(new Set(values).size).toBe(values.length);
	});
});

describe("getTableSizeClassName", () => {
	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("returns the registered value for size %i", (size) => {
		expect(getTableSizeClassName(size)).toBe(TABLE_SIZE_COLORS[size]);
	});

	it("falls back to muted styles when size is 0", () => {
		expect(getTableSizeClassName(0)).toBe("bg-muted text-muted-foreground");
	});

	it("falls back to muted styles when size is 1", () => {
		expect(getTableSizeClassName(1)).toBe("bg-muted text-muted-foreground");
	});

	it("falls back to muted styles when size is 11 (out of range)", () => {
		expect(getTableSizeClassName(11)).toBe("bg-muted text-muted-foreground");
	});

	it("falls back to muted styles for negative values", () => {
		expect(getTableSizeClassName(-1)).toBe("bg-muted text-muted-foreground");
	});

	it("falls back to muted styles for non-integer values", () => {
		expect(getTableSizeClassName(3.5)).toBe("bg-muted text-muted-foreground");
	});

	it("falls back to muted styles for NaN", () => {
		expect(getTableSizeClassName(Number.NaN)).toBe(
			"bg-muted text-muted-foreground"
		);
	});
});
