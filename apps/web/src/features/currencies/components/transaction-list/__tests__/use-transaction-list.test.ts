import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTransactionList } from "@/features/currencies/components/transaction-list/use-transaction-list";

const TRANSACTIONS = [
	{
		id: "tx1",
		amount: 100,
		transactedAt: "2026-04-01",
		transactionTypeName: "Deposit",
	},
	{
		id: "tx2",
		amount: -50,
		transactedAt: "2026-04-02",
		transactionTypeName: "Withdrawal",
	},
];

describe("useTransactionList", () => {
	it("starts with no expanded id and no confirming delete id", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		expect(result.current.expandedId).toBeNull();
		expect(result.current.confirmingDeleteId).toBeNull();
	});

	it("onExpand sets expandedId and clears confirmingDeleteId", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		act(() => {
			result.current.onConfirmDelete("tx1");
		});
		expect(result.current.confirmingDeleteId).toBe("tx1");
		act(() => {
			result.current.onExpand("tx2");
		});
		expect(result.current.expandedId).toBe("tx2");
		expect(result.current.confirmingDeleteId).toBeNull();
	});

	it("onCollapse resets both expandedId and confirmingDeleteId to null", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		act(() => {
			result.current.onExpand("tx1");
			result.current.onConfirmDelete("tx1");
		});
		act(() => {
			result.current.onCollapse();
		});
		expect(result.current.expandedId).toBeNull();
		expect(result.current.confirmingDeleteId).toBeNull();
	});

	it("onConfirmDelete sets confirmingDeleteId", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		act(() => {
			result.current.onConfirmDelete("tx1");
		});
		expect(result.current.confirmingDeleteId).toBe("tx1");
	});

	it("onConfirmDeleteCancel clears confirmingDeleteId", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		act(() => {
			result.current.onConfirmDelete("tx1");
		});
		act(() => {
			result.current.onConfirmDeleteCancel();
		});
		expect(result.current.confirmingDeleteId).toBeNull();
	});

	it("exposes amount class helpers for positive and negative values", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		expect(result.current.getAmountClass(100)).toBe("text-green-600");
		expect(result.current.getAmountClass(-1)).toBe("text-red-600");
		expect(result.current.getAmountClass(0)).toBe("text-green-600");
	});

	it("getAmountDisplay prefixes non-negative amounts with '+'", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		expect(result.current.getAmountDisplay(100).startsWith("+")).toBe(true);
		expect(result.current.getAmountDisplay(-1).startsWith("+")).toBe(false);
	});

	it("exposes a group formatter function that returns a string", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		expect(typeof result.current.fmt(123)).toBe("string");
	});

	it("getDateDisplay returns a formatted string for a valid date", () => {
		const { result } = renderHook(() => useTransactionList(TRANSACTIONS));
		const output = result.current.getDateDisplay("2026-04-01");
		expect(typeof output).toBe("string");
		expect(output.length).toBeGreaterThan(0);
	});
});
