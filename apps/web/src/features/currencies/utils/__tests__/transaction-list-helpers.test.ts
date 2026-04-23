import { describe, expect, it } from "vitest";
import {
	buildGroupFormatter,
	getAmountClass,
	getAmountDisplay,
	getDateDisplay,
	type TransactionDisplayItem,
} from "@/features/currencies/utils/transaction-list-helpers";

const YMD_MARCH_5 = /^2026\/03\/05$/;

describe("buildGroupFormatter", () => {
	it("produces a plain formatter when max < 10k", () => {
		const txs: TransactionDisplayItem[] = [
			{
				id: "1",
				amount: 100,
				transactionTypeName: "Deposit",
				transactedAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "2",
				amount: 9999,
				transactionTypeName: "Withdraw",
				transactedAt: "2026-01-02T00:00:00.000Z",
			},
		];
		const fmt = buildGroupFormatter(txs);
		expect(fmt(100)).toBe("100");
		expect(fmt(9999)).toBe("9,999");
	});

	it("locks to k tier when any transaction breaches 10k", () => {
		const txs: TransactionDisplayItem[] = [
			{
				id: "1",
				amount: 100,
				transactionTypeName: "Deposit",
				transactedAt: "2026-01-01T00:00:00.000Z",
			},
			{
				id: "2",
				amount: 10_000,
				transactionTypeName: "Deposit",
				transactedAt: "2026-01-02T00:00:00.000Z",
			},
		];
		const fmt = buildGroupFormatter(txs);
		expect(fmt(100)).toBe("0.1k");
		expect(fmt(10_000)).toBe("10k");
	});

	it("returns plain formatter for empty list", () => {
		const fmt = buildGroupFormatter([]);
		expect(fmt(0)).toBe("0");
		expect(fmt(500)).toBe("500");
	});
});

describe("getAmountClass", () => {
	it("green for positive", () => {
		expect(getAmountClass(1)).toBe("text-green-600");
	});

	it("green for zero (treated as non-negative)", () => {
		expect(getAmountClass(0)).toBe("text-green-600");
	});

	it("red for negative", () => {
		expect(getAmountClass(-1)).toBe("text-red-600");
	});
});

describe("getAmountDisplay", () => {
	const passthrough = (n: number) => String(n);

	it("prefixes '+' for positive amounts", () => {
		expect(getAmountDisplay(42, passthrough)).toBe("+42");
	});

	it("prefixes '+' for zero", () => {
		expect(getAmountDisplay(0, passthrough)).toBe("+0");
	});

	it("does NOT prefix '+' for negative amounts (delegates to fmt)", () => {
		expect(getAmountDisplay(-42, passthrough)).toBe("-42");
	});

	it("calls the provided formatter exactly once", () => {
		let calls = 0;
		const fmt = (n: number) => {
			calls += 1;
			return String(n);
		};
		getAmountDisplay(10, fmt);
		expect(calls).toBe(1);
	});
});

describe("getDateDisplay", () => {
	it("formats Date input as Y/MM/DD", () => {
		expect(getDateDisplay(new Date(2026, 2, 5))).toBe("2026/03/05");
	});

	it("formats ISO string input", () => {
		// Date-only ISO normalizes in UTC; assert it matches Y/MM/DD shape.
		expect(getDateDisplay("2026-03-05T12:00:00")).toMatch(YMD_MARCH_5);
	});
});
