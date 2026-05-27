import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTransactionListV2 } from "@/features/currencies/v2/components/transaction-list/use-transaction-list";

const YEAR_2026 = /2026/;

describe("useTransactionListV2", () => {
	describe("initial state", () => {
		it("starts with no expansion and no pending delete", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			expect(result.current.expandedId).toBeNull();
			expect(result.current.confirmingDeleteId).toBeNull();
		});
	});

	describe("onExpand / onCollapse", () => {
		it("sets expandedId and clears any pending delete", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			act(() => result.current.onConfirmDelete("tx-1"));
			act(() => result.current.onExpand("tx-2"));
			expect(result.current.expandedId).toBe("tx-2");
			expect(result.current.confirmingDeleteId).toBeNull();
		});

		it("collapses by setting expandedId back to null", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			act(() => result.current.onExpand("tx-1"));
			act(() => result.current.onCollapse());
			expect(result.current.expandedId).toBeNull();
		});

		it("collapse also clears any pending delete", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			act(() => result.current.onExpand("tx-1"));
			act(() => result.current.onConfirmDelete("tx-1"));
			act(() => result.current.onCollapse());
			expect(result.current.confirmingDeleteId).toBeNull();
		});
	});

	describe("onConfirmDelete / onConfirmDeleteCancel", () => {
		it("flags the targeted tx id as pending delete", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			act(() => result.current.onConfirmDelete("tx-7"));
			expect(result.current.confirmingDeleteId).toBe("tx-7");
		});

		it("resets pending delete to null on cancel", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			act(() => result.current.onConfirmDelete("tx-7"));
			act(() => result.current.onConfirmDeleteCancel());
			expect(result.current.confirmingDeleteId).toBeNull();
		});
	});

	describe("getAmountClass", () => {
		it("returns the success-token utility for non-negative amounts", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			expect(result.current.getAmountClass(0)).toContain("--success");
			expect(result.current.getAmountClass(100)).toContain("--success");
		});

		it("returns text-destructive for negative amounts", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			expect(result.current.getAmountClass(-1)).toBe("text-destructive");
		});
	});

	describe("getAmountDisplay", () => {
		it("prepends + for positive amounts", () => {
			const { result } = renderHook(() =>
				useTransactionListV2([
					{
						id: "a",
						amount: 100,
						transactionTypeName: "x",
						transactedAt: "2026-01-01",
					},
				])
			);
			expect(result.current.getAmountDisplay(100)).toBe("+100");
		});

		it("renders negative amounts with their native sign (no double minus)", () => {
			const { result } = renderHook(() =>
				useTransactionListV2([
					{
						id: "a",
						amount: -50,
						transactionTypeName: "x",
						transactedAt: "2026-01-01",
					},
				])
			);
			expect(result.current.getAmountDisplay(-50)).toBe("-50");
		});

		it("renders 0 as +0 (the >=0 branch)", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			expect(result.current.getAmountDisplay(0)).toBe("+0");
		});

		it("applies the group's tier when any value crosses the 10k threshold", () => {
			const { result } = renderHook(() =>
				useTransactionListV2([
					{
						id: "a",
						amount: 100,
						transactionTypeName: "x",
						transactedAt: "2026-01-01",
					},
					{
						id: "b",
						amount: 50_000,
						transactionTypeName: "x",
						transactedAt: "2026-01-01",
					},
				])
			);
			expect(result.current.getAmountDisplay(100)).toBe("+0.1k");
			expect(result.current.getAmountDisplay(50_000)).toBe("+50k");
		});
	});

	describe("getDateDisplay", () => {
		it("formats a Date as YYYY/MM/DD", () => {
			const { result } = renderHook(() => useTransactionListV2([]));
			expect(
				result.current.getDateDisplay(new Date("2026-03-20T12:00:00Z"))
			).toMatch(YEAR_2026);
		});
	});
});
