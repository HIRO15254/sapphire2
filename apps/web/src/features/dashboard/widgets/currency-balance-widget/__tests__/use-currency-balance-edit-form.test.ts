import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
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

import { useCurrencyBalanceEditForm } from "@/features/dashboard/widgets/currency-balance-widget/use-currency-balance-edit-form";

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

describe("useCurrencyBalanceEditForm", () => {
	it("defaults currencyId to FIRST_AVAILABLE when config has no currencyId", () => {
		const qc = createClient();
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useCurrencyBalanceEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.form.state.values.currencyId).toBe(
			result.current.FIRST_AVAILABLE
		);
	});

	it("seeds currencyId from config when present as a string", () => {
		const qc = createClient();
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() =>
				useCurrencyBalanceEditForm({ config: { currencyId: "c1" }, onSave }),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.form.state.values.currencyId).toBe("c1");
	});

	it("falls back to FIRST_AVAILABLE when config.currencyId is non-string", () => {
		const qc = createClient();
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useCurrencyBalanceEditForm({ config: { currencyId: 42 }, onSave }),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.form.state.values.currencyId).toBe(
			result.current.FIRST_AVAILABLE
		);
	});

	it("submits null when currencyId is FIRST_AVAILABLE", async () => {
		const qc = createClient();
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useCurrencyBalanceEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({ currencyId: null });
	});

	it("submits the concrete id when a currency is chosen", async () => {
		const qc = createClient();
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() =>
				useCurrencyBalanceEditForm({ config: { currencyId: "c2" }, onSave }),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSave).toHaveBeenCalledWith({ currencyId: "c2" });
	});

	it("exposes currency options from the trpc cache", () => {
		const qc = createClient();
		qc.setQueryData(
			["currency", "list"],
			[{ id: "c1", name: "Chips", unit: null }]
		);
		const onSave = vi.fn().mockResolvedValue(undefined);
		const { result } = renderHook(
			() => useCurrencyBalanceEditForm({ config: {}, onSave }),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.currencies).toEqual([
			{ id: "c1", name: "Chips", unit: null },
		]);
	});
});
