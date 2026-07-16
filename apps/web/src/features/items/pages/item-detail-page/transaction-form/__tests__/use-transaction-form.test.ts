import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTransactionForm } from "@/features/items/pages/item-detail-page/transaction-form/use-transaction-form";

const TODAY_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe("useTransactionForm (item)", () => {
	it("defaults transactedAt to today's ISO date when no defaults provided", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		expect(result.current.form.state.values.transactedAt).toMatch(
			TODAY_ISO_PATTERN
		);
	});

	it("starts with an empty count and memo", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		expect(result.current.form.state.values.count).toBe("");
		expect(result.current.form.state.values.memo).toBe("");
	});

	it("seeds count as string and slices transactedAt from an ISO datetime default", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTransactionForm({
				onSubmit,
				defaultValues: {
					count: -2,
					transactedAt: "2026-04-01T00:00:00.000Z",
					memo: "note",
				},
			})
		);
		expect(result.current.form.state.values.count).toBe("-2");
		expect(result.current.form.state.values.memo).toBe("note");
		expect(result.current.form.state.values.transactedAt).toBe("2026-04-01");
	});

	it("rejects submit when count is missing", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("rejects a zero count (no-op ledger rows are not allowed)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it.each([
		"1.5",
		"-0.5",
		"Infinity",
		"NaN",
		"abc",
	])("rejects the non-integer count %s", async (count) => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", count);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(0);
	});

	it("rejects submit when transactedAt is cleared", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", "1");
			result.current.form.setFieldValue("transactedAt", "");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("accepts a positive count at the +1 boundary and omits an empty memo", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", "1");
			result.current.form.setFieldValue("transactedAt", "2026-04-10");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			count: 1,
			transactedAt: "2026-04-10",
			memo: undefined,
		});
	});

	it("accepts a negative count at the -1 boundary (spend entry)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", "-1");
			result.current.form.setFieldValue("transactedAt", "2026-04-10");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			count: -1,
			transactedAt: "2026-04-10",
			memo: undefined,
		});
	});

	it("submits the memo verbatim when non-empty", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTransactionForm({ onSubmit }));
		act(() => {
			result.current.form.setFieldValue("count", "2");
			result.current.form.setFieldValue("transactedAt", "2026-04-11");
			result.current.form.setFieldValue("memo", "bought at store");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith({
			count: 2,
			transactedAt: "2026-04-11",
			memo: "bought at store",
		});
	});

	it("passes the edited date-only string through unchanged (UTC date-only round-trip)", async () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTransactionForm({
				onSubmit,
				defaultValues: {
					count: 1,
					transactedAt: "2026-04-01T00:00:00.000Z",
					memo: undefined,
				},
			})
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		// The UTC-midnight ISO default must not shift a day through the form.
		expect(onSubmit).toHaveBeenCalledWith({
			count: 1,
			transactedAt: "2026-04-01",
			memo: undefined,
		});
	});
});
