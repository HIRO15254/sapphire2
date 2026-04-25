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

import { useRingGameForm } from "@/features/stores/components/ring-game-form/use-ring-game-form";

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

describe("useRingGameForm", () => {
	it("defaults variant to nlh, anteType to none, empty strings elsewhere", () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.form.state.values.variant).toBe("nlh");
		expect(result.current.form.state.values.anteType).toBe("none");
		expect(result.current.form.state.values.name).toBe("");
		expect(result.current.form.state.values.blind1).toBe("");
	});

	it("seeds form from defaultValues", () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useRingGameForm({
					onSubmit,
					defaultValues: {
						name: "1/2 NLH",
						variant: "nlh",
						blind1: 1,
						blind2: 2,
						blind3: 0,
						ante: 5,
						anteType: "all",
						minBuyIn: 40,
						maxBuyIn: 200,
						tableSize: 9,
						currencyId: "c1",
						memo: "cozy",
					},
				}),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.form.state.values).toEqual({
			name: "1/2 NLH",
			variant: "nlh",
			blind1: "1",
			blind2: "2",
			blind3: "0",
			ante: "5",
			anteType: "all",
			minBuyIn: "40",
			maxBuyIn: "200",
			tableSize: "9",
			currencyId: "c1",
			memo: "cozy",
		});
	});

	it("rejects submit with empty name", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with ante undefined when anteType is 'none'", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.form.setFieldValue("name", "1/2");
			result.current.form.setFieldValue("ante", "5");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ ante: undefined, anteType: "none" })
		);
	});

	it("submits with ante parsed when anteType is 'bb'", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.form.setFieldValue("name", "1/2");
			result.current.form.setFieldValue("anteType", "bb");
			result.current.form.setFieldValue("ante", "5");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ ante: 5, anteType: "bb" })
		);
	});

	it("exposes the currency list from the query cache", () => {
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "Chips" }]);
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([{ id: "c1", name: "Chips" }]);
	});
});
