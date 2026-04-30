import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		store: { list: { queryOptions: () => ({ queryKey: ["store-list"] }) } },
		currency: {
			list: { queryOptions: () => ({ queryKey: ["currency-list"] }) },
		},
	},
}));

import { useGlobalFilterEditForm } from "@/features/dashboard/widgets/global-filter-widget/use-global-filter-edit-form";

function wrapper() {
	const qc = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client: qc }, children);
	};
}

describe("useGlobalFilterEditForm", () => {
	it("defaults from empty config: every field visible, every initial empty", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useGlobalFilterEditForm({ config: {}, onSave }),
			{ wrapper: wrapper() }
		);
		const v = result.current.form.state.values;
		expect(v.typeVisible).toBe(true);
		expect(v.storeIdVisible).toBe(true);
		expect(v.currencyIdVisible).toBe(true);
		expect(v.dateFromVisible).toBe(true);
		expect(v.dateToVisible).toBe(true);
		expect(v.dateRangeDaysVisible).toBe(true);
		expect(v.typeInitial).toBe("");
		expect(v.storeIdInitial).toBe("");
		expect(v.currencyIdInitial).toBe("");
		expect(v.dateFromInitial).toBe("");
		expect(v.dateToInitial).toBe("");
		expect(v.dateRangeDaysInitial).toBe("");
	});

	it("seeds initial values from existing config", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() =>
				useGlobalFilterEditForm({
					config: {
						type: { initialValue: "cash_game", visible: true },
						storeId: { initialValue: "store-1", visible: false },
						dateRangeDays: { initialValue: 30, visible: true },
					},
					onSave,
				}),
			{ wrapper: wrapper() }
		);
		const v = result.current.form.state.values;
		expect(v.typeInitial).toBe("cash_game");
		expect(v.storeIdInitial).toBe("store-1");
		expect(v.storeIdVisible).toBe(false);
		expect(v.dateRangeDaysInitial).toBe("30");
	});

	it("submits a complete config object back to onSave", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useGlobalFilterEditForm({ config: {}, onSave }),
			{ wrapper: wrapper() }
		);
		act(() => {
			result.current.form.setFieldValue("typeVisible", true);
			result.current.form.setFieldValue("typeInitial", "cash_game");
			result.current.form.setFieldValue("storeIdVisible", false);
			result.current.form.setFieldValue("storeIdInitial", "store-1");
			result.current.form.setFieldValue("currencyIdVisible", true);
			result.current.form.setFieldValue("currencyIdInitial", "currency-1");
			result.current.form.setFieldValue("dateFromVisible", true);
			result.current.form.setFieldValue("dateFromInitial", "2026-01-01");
			result.current.form.setFieldValue("dateToVisible", false);
			result.current.form.setFieldValue("dateToInitial", "2026-12-31");
			result.current.form.setFieldValue("dateRangeDaysVisible", true);
			result.current.form.setFieldValue("dateRangeDaysInitial", "14");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith({
			type: { initialValue: "cash_game", visible: true },
			storeId: { initialValue: "store-1", visible: false },
			currencyId: { initialValue: "currency-1", visible: true },
			dateFrom: { initialValue: "2026-01-01", visible: true },
			dateTo: { initialValue: "2026-12-31", visible: false },
			dateRangeDays: { initialValue: 14, visible: true },
		});
	});

	it("submits nulls when text fields are empty", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useGlobalFilterEditForm({ config: {}, onSave }),
			{ wrapper: wrapper() }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({
			type: { initialValue: null, visible: true },
			storeId: { initialValue: null, visible: true },
			currencyId: { initialValue: null, visible: true },
			dateFrom: { initialValue: null, visible: true },
			dateTo: { initialValue: null, visible: true },
			dateRangeDays: { initialValue: null, visible: true },
		});
	});

	it("rejects dateRangeDays below 1", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useGlobalFilterEditForm({ config: {}, onSave }),
			{ wrapper: wrapper() }
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDaysInitial", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});

	it("rejects dateRangeDays above 3650", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useGlobalFilterEditForm({ config: {}, onSave }),
			{ wrapper: wrapper() }
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDaysInitial", "9999");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});
});
