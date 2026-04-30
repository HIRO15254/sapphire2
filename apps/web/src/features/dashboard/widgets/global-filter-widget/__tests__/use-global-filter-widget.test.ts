import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
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

import {
	DEFAULT_GLOBAL_FILTER_VALUES,
	GlobalFilterProvider,
	type GlobalFilterValues,
} from "@/features/dashboard/hooks/use-global-filter";
import { useGlobalFilterWidget } from "@/features/dashboard/widgets/global-filter-widget/use-global-filter-widget";

function createClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapperWith({
	values = DEFAULT_GLOBAL_FILTER_VALUES,
	stores = [] as Array<{ id: string; name: string }>,
	currencies = [] as Array<{ id: string; name: string }>,
	setValue = vi.fn(),
	reset = vi.fn(),
}: {
	currencies?: Array<{ id: string; name: string }>;
	reset?: () => void;
	setValue?: <K extends keyof GlobalFilterValues>(
		key: K,
		value: GlobalFilterValues[K]
	) => void;
	stores?: Array<{ id: string; name: string }>;
	values?: GlobalFilterValues;
}) {
	const qc = createClient();
	qc.setQueryData(["store-list"], stores);
	qc.setQueryData(["currency-list"], currencies);
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client: qc },
			createElement(
				GlobalFilterProvider,
				{ value: { values, setValue, reset } },
				children
			)
		);
	};
}

describe("useGlobalFilterWidget", () => {
	it("hasAnyVisible=false when every field is hidden", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					type: { initialValue: null, visible: false },
					storeId: { initialValue: null, visible: false },
					currencyId: { initialValue: null, visible: false },
					dateFrom: { initialValue: null, visible: false },
					dateTo: { initialValue: null, visible: false },
					dateRangeDays: { initialValue: null, visible: false },
				}),
			{ wrapper: wrapperWith({}) }
		);
		expect(result.current.hasAnyVisible).toBe(false);
		expect(result.current.visibleFields).toEqual([]);
	});

	it("returns visible fields in canonical order", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					storeId: { initialValue: null, visible: false },
					dateRangeDays: { initialValue: null, visible: true },
					type: { initialValue: null, visible: true },
				}),
			{ wrapper: wrapperWith({}) }
		);
		expect(result.current.visibleFields.map((f) => f.key)).toEqual([
			"type",
			"currencyId",
			"dateFrom",
			"dateTo",
			"dateRangeDays",
		]);
	});

	it("hasDirtyValues is false when runtime values match config initialValues", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					type: { initialValue: "cash_game", visible: true },
				}),
			{
				wrapper: wrapperWith({
					values: {
						...DEFAULT_GLOBAL_FILTER_VALUES,
						type: "cash_game",
					},
				}),
			}
		);
		expect(result.current.hasDirtyValues).toBe(false);
	});

	it("hasDirtyValues is true when runtime differs from initial", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					type: { initialValue: "cash_game", visible: true },
				}),
			{
				wrapper: wrapperWith({
					values: {
						...DEFAULT_GLOBAL_FILTER_VALUES,
						type: "tournament",
					},
				}),
			}
		);
		expect(result.current.hasDirtyValues).toBe(true);
	});

	it("hasDirtyValues only considers visible fields", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					type: { initialValue: null, visible: true },
					storeId: { initialValue: "store-A", visible: false },
				}),
			{
				wrapper: wrapperWith({
					values: {
						...DEFAULT_GLOBAL_FILTER_VALUES,
						storeId: "store-Z",
					},
				}),
			}
		);
		expect(result.current.hasDirtyValues).toBe(false);
	});

	it("forwards onValueChange and onReset to context handlers", () => {
		const setValue = vi.fn();
		const reset = vi.fn();
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					type: { initialValue: null, visible: true },
				}),
			{ wrapper: wrapperWith({ setValue, reset }) }
		);
		result.current.onValueChange("type", "cash_game");
		result.current.onReset();
		expect(setValue).toHaveBeenCalledTimes(1);
		expect(setValue).toHaveBeenCalledWith("type", "cash_game");
		expect(reset).toHaveBeenCalledTimes(1);
	});

	it("exposes stores and currencies from cache", () => {
		const { result } = renderHook(
			() =>
				useGlobalFilterWidget({
					storeId: { initialValue: null, visible: true },
					currencyId: { initialValue: null, visible: true },
				}),
			{
				wrapper: wrapperWith({
					stores: [{ id: "s1", name: "Store 1" }],
					currencies: [{ id: "c1", name: "USD" }],
				}),
			}
		);
		expect(result.current.stores).toEqual([{ id: "s1", name: "Store 1" }]);
		expect(result.current.currencies).toEqual([{ id: "c1", name: "USD" }]);
	});
});
