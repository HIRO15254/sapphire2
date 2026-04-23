import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("currency", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
}));

import {
	parseCurrencyBalanceWidgetConfig,
	useCurrencyBalanceOptions,
	useCurrencyBalanceWidget,
} from "@/features/dashboard/widgets/currency-balance-widget/use-currency-balance-widget";

const CURRENCY_KEY = ["currency", "list"];

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

describe("parseCurrencyBalanceWidgetConfig", () => {
	it("returns null currencyId when not a string", () => {
		expect(parseCurrencyBalanceWidgetConfig({}).currencyId).toBeNull();
		expect(
			parseCurrencyBalanceWidgetConfig({ currencyId: 1 }).currencyId
		).toBeNull();
		expect(
			parseCurrencyBalanceWidgetConfig({ currencyId: null }).currencyId
		).toBeNull();
	});

	it("returns the currencyId string when provided", () => {
		expect(
			parseCurrencyBalanceWidgetConfig({ currencyId: "c1" }).currencyId
		).toBe("c1");
	});
});

describe("useCurrencyBalanceWidget", () => {
	it("selects the first currency when currencyId is null", async () => {
		const qc = createClient();
		qc.setQueryData(CURRENCY_KEY, [
			{ id: "c1", name: "A" },
			{ id: "c2", name: "B" },
		]);
		const { result } = renderHook(() => useCurrencyBalanceWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.currencies).toHaveLength(2));
		expect(result.current.selected?.id).toBe("c1");
	});

	it("selects the matching currency when currencyId is provided", async () => {
		const qc = createClient();
		qc.setQueryData(CURRENCY_KEY, [
			{ id: "c1", name: "A" },
			{ id: "c2", name: "B" },
		]);
		const { result } = renderHook(
			() => useCurrencyBalanceWidget({ currencyId: "c2" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.selected?.id).toBe("c2"));
	});

	it("returns undefined selected when currencyId does not match any currency", async () => {
		const qc = createClient();
		qc.setQueryData(CURRENCY_KEY, [{ id: "c1", name: "A" }]);
		const { result } = renderHook(
			() => useCurrencyBalanceWidget({ currencyId: "missing" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.currencies).toHaveLength(1));
		expect(result.current.selected).toBeUndefined();
	});

	it("returns empty currencies when query is not seeded", () => {
		const qc = createClient();
		const { result } = renderHook(() => useCurrencyBalanceWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([]);
		expect(result.current.selected).toBeUndefined();
	});
});

describe("useCurrencyBalanceOptions", () => {
	it("returns the cached list", async () => {
		const qc = createClient();
		qc.setQueryData(CURRENCY_KEY, [{ id: "c1", name: "A" }]);
		const { result } = renderHook(() => useCurrencyBalanceOptions(), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current).toHaveLength(1));
	});

	it("returns empty array when nothing is cached", () => {
		const qc = createClient();
		const { result } = renderHook(() => useCurrencyBalanceOptions(), {
			wrapper: wrapper(qc),
		});
		expect(result.current).toEqual([]);
	});
});
