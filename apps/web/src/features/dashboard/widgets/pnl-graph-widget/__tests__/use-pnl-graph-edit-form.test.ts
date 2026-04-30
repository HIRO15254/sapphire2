import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		store: {
			list: {
				queryOptions: () => ({
					queryKey: ["store", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: ["currency", "list"],
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: (input: { storeId: string }, opts?: unknown) => ({
					queryKey: ["ringGame", "listByStore", input],
					queryFn: () => Promise.resolve([]),
					...((opts as object) ?? {}),
				}),
			},
		},
	},
	trpcClient: {},
}));

import { usePnlGraphEditForm } from "@/features/dashboard/widgets/pnl-graph-widget/use-pnl-graph-edit-form";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("usePnlGraphEditForm", () => {
	it("seeds form defaults from an empty config", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => usePnlGraphEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(createClient()) }
		);
		const v = result.current.form.state.values;
		expect(v.xAxis).toBe("date");
		expect(v.dateRangeDays).toBe("");
		expect(v.sessionType).toBe("all");
		expect(v.unit).toBe("currency");
		expect(v.storeId).toBe("__none__");
		expect(v.ringGameId).toBe("__none__");
		expect(v.currencyId).toBe("__none__");
		expect(v.showXAxis).toBe(false);
		expect(v.showDateRange).toBe(false);
	});

	it("seeds form defaults from a populated config", () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() =>
				usePnlGraphEditForm({
					config: {
						xAxis: "sessionCount",
						dateRangeDays: 30,
						sessionType: "tournament",
						unit: "normalized",
						storeId: "s1",
						ringGameId: "rg1",
						currencyId: "c1",
						showFilters: { xAxis: true, unit: true },
					},
					onSave,
				}),
			{ wrapper: wrapper(createClient()) }
		);
		const v = result.current.form.state.values;
		expect(v.xAxis).toBe("sessionCount");
		expect(v.dateRangeDays).toBe("30");
		expect(v.sessionType).toBe("tournament");
		expect(v.unit).toBe("normalized");
		expect(v.storeId).toBe("s1");
		expect(v.ringGameId).toBe("rg1");
		expect(v.currencyId).toBe("c1");
		expect(v.showXAxis).toBe(true);
		expect(v.showUnit).toBe(true);
	});

	it("submits the saved config with parsed values, mapping __none__ to null", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => usePnlGraphEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(createClient()) }
		);
		act(() => {
			result.current.form.setFieldValue("xAxis", "playTime");
			result.current.form.setFieldValue("dateRangeDays", "14");
			result.current.form.setFieldValue("sessionType", "cash_game");
			result.current.form.setFieldValue("unit", "normalized");
			result.current.form.setFieldValue("storeId", "store-7");
			result.current.form.setFieldValue("ringGameId", "rg-9");
			result.current.form.setFieldValue("currencyId", "__none__");
			result.current.form.setFieldValue("showXAxis", true);
			result.current.form.setFieldValue("showUnit", true);
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith({
			xAxis: "playTime",
			dateRangeDays: 14,
			sessionType: "cash_game",
			unit: "normalized",
			storeId: "store-7",
			ringGameId: "rg-9",
			currencyId: null,
			showFilters: {
				xAxis: true,
				dateRange: false,
				sessionType: false,
				unit: true,
				store: false,
				currency: false,
			},
		});
	});

	it("submits dateRangeDays as null when blank", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => usePnlGraphEditForm({ config: { dateRangeDays: 5 }, onSave }),
			{ wrapper: wrapper(createClient()) }
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDays", "  ");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith(
			expect.objectContaining({ dateRangeDays: null })
		);
	});

	it("rejects non-positive dateRangeDays via the Zod validator", async () => {
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => usePnlGraphEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(createClient()) }
		);
		act(() => {
			result.current.form.setFieldValue("dateRangeDays", "0");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).not.toHaveBeenCalled();
	});
});
