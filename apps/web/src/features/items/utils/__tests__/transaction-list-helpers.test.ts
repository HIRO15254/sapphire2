import { describe, expect, it } from "vitest";
import {
	buildGroupFormatter,
	getCountColorClass,
	getCountDisplay,
	getDateDisplay,
	groupTransactionsByDate,
	type TransactionDisplayItem,
} from "@/features/items/utils/transaction-list-helpers";

function tx(
	id: string,
	transactedAt: string | Date,
	overrides: Partial<TransactionDisplayItem> = {}
): TransactionDisplayItem {
	return {
		id,
		count: 2,
		transactedAt,
		...overrides,
	};
}

describe("buildGroupFormatter", () => {
	it("produces a plain formatter when max < 10k", () => {
		const txs: TransactionDisplayItem[] = [
			{ id: "1", count: 3, transactedAt: "2026-01-01T00:00:00.000Z" },
			{ id: "2", count: 9999, transactedAt: "2026-01-02T00:00:00.000Z" },
		];
		const fmt = buildGroupFormatter(txs);
		expect(fmt(3)).toBe("3");
		expect(fmt(9999)).toBe("9,999");
	});

	it("locks to k tier when any transaction breaches 10k", () => {
		const txs: TransactionDisplayItem[] = [
			{ id: "1", count: 100, transactedAt: "2026-01-01T00:00:00.000Z" },
			{ id: "2", count: 10_000, transactedAt: "2026-01-02T00:00:00.000Z" },
		];
		const fmt = buildGroupFormatter(txs);
		expect(fmt(100)).toBe("0.1k");
		expect(fmt(10_000)).toBe("10k");
	});

	it("returns a plain formatter for an empty list", () => {
		const fmt = buildGroupFormatter([]);
		expect(fmt(0)).toBe("0");
		expect(fmt(500)).toBe("500");
	});
});

describe("getCountColorClass", () => {
	it("uses the success token for a positive count", () => {
		expect(getCountColorClass(1)).toBe("text-success");
	});

	it("uses the success token for zero (treated as non-negative)", () => {
		expect(getCountColorClass(0)).toBe("text-success");
	});

	it("uses the destructive token for a negative count", () => {
		expect(getCountColorClass(-1)).toBe("text-destructive");
	});
});

describe("getCountDisplay", () => {
	const passthrough = (n: number) => String(n);

	it("prefixes '+' for positive counts", () => {
		expect(getCountDisplay(2, passthrough)).toBe("+2");
	});

	it("prefixes '+' for zero", () => {
		expect(getCountDisplay(0, passthrough)).toBe("+0");
	});

	it("does NOT prefix '+' for negative counts (delegates to fmt)", () => {
		expect(getCountDisplay(-1, passthrough)).toBe("-1");
	});

	it("calls the provided formatter exactly once", () => {
		let calls = 0;
		const fmt = (n: number) => {
			calls += 1;
			return String(n);
		};
		getCountDisplay(10, fmt);
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
		expect(groups[0].items.map((t) => t.id)).toEqual(["1"]);
		expect(groups[1].items.map((t) => t.id)).toEqual(["2"]);
	});

	it("only merges consecutive same-day rows (a re-appearing day starts a new group)", () => {
		const groups = groupTransactionsByDate([
			tx("1", "2026-03-20T10:00:00"),
			tx("2", "2026-03-19T10:00:00"),
			tx("3", "2026-03-20T18:00:00"),
		]);
		expect(groups.map((g) => g.label)).toEqual([
			"2026/03/20",
			"2026/03/19",
			"2026/03/20",
		]);
	});

	it("assigns unique keys to repeated labels", () => {
		const groups = groupTransactionsByDate([
			tx("1", "2026-03-20T10:00:00"),
			tx("2", "2026-03-19T10:00:00"),
			tx("3", "2026-03-20T18:00:00"),
		]);
		const keys = groups.map((g) => g.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
