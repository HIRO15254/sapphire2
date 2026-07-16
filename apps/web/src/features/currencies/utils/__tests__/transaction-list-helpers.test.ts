import { describe, expect, it } from "vitest";
import {
	buildGroupFormatter,
	getAmountColorClass,
	getAmountDisplay,
	getDateDisplay,
	groupTransactionsByDate,
	type TransactionDisplayItem,
} from "@/features/currencies/utils/transaction-list-helpers";

function tx(
	id: string,
	transactedAt: string | Date,
	overrides: Partial<TransactionDisplayItem> = {}
): TransactionDisplayItem {
	return {
		id,
		amount: 100,
		transactionTypeName: "Deposit",
		transactedAt,
		...overrides,
	};
}

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

describe("getAmountColorClass", () => {
	it("uses the success token for a positive amount", () => {
		expect(getAmountColorClass(1)).toBe("text-success");
	});

	it("uses the success token for zero (treated as non-negative)", () => {
		expect(getAmountColorClass(0)).toBe("text-success");
	});

	it("uses the destructive token for a negative amount", () => {
		expect(getAmountColorClass(-1)).toBe("text-destructive");
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
	it("formats a UTC Date input as Y/MM/DD", () => {
		expect(getDateDisplay(new Date(Date.UTC(2026, 2, 5)))).toBe("2026/03/05");
	});

	it("formats an explicit UTC ISO string", () => {
		expect(getDateDisplay("2026-03-05T12:00:00Z")).toBe("2026/03/05");
	});
});

describe("groupTransactionsByDate", () => {
	it("returns an empty array for no transactions", () => {
		expect(groupTransactionsByDate([])).toEqual([]);
	});

	it("returns a single group for one transaction", () => {
		const groups = groupTransactionsByDate([tx("1", "2026-03-20T10:00:00")]);
		expect(groups).toHaveLength(1);
		expect(groups[0].label).toBe("2026/03/20");
		expect(groups[0].items.map((t) => t.id)).toEqual(["1"]);
	});

	it("merges multiple transactions on the same day into one group", () => {
		const groups = groupTransactionsByDate([
			tx("1", "2026-03-20T10:00:00"),
			tx("2", "2026-03-20T18:00:00"),
			tx("3", "2026-03-20T23:00:00"),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0].items.map((t) => t.id)).toEqual(["1", "2", "3"]);
	});

	it("splits different days into separate groups, preserving order", () => {
		const groups = groupTransactionsByDate([
			tx("1", "2026-03-20T10:00:00"),
			tx("2", "2026-03-19T10:00:00"),
		]);
		expect(groups.map((g) => g.label)).toEqual(["2026/03/20", "2026/03/19"]);
		expect(groups.map((g) => g.items.length)).toEqual([1, 1]);
	});

	it("keeps a re-appearing date as its own group (only consecutive rows merge)", () => {
		const groups = groupTransactionsByDate([
			tx("1", "2026-03-20T10:00:00"),
			tx("2", "2026-03-19T10:00:00"),
			tx("3", "2026-03-20T09:00:00"),
		]);
		expect(groups).toHaveLength(3);
		expect(groups.map((g) => g.label)).toEqual([
			"2026/03/20",
			"2026/03/19",
			"2026/03/20",
		]);
		expect(groups.map((g) => g.key)).toEqual([
			"2026/03/20-0",
			"2026/03/19-1",
			"2026/03/20-2",
		]);
	});

	it("groups Date-object inputs the same as ISO strings", () => {
		const groups = groupTransactionsByDate([
			tx("1", new Date(2026, 2, 20, 10)),
			tx("2", new Date(2026, 2, 20, 20)),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0].label).toBe("2026/03/20");
	});
});
