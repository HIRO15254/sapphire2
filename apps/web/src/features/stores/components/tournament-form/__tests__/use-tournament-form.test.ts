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

import { useTournamentForm } from "@/features/stores/components/tournament-form/use-tournament-form";

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

describe("useTournamentForm", () => {
	it("defaults variant to nlh and has no chipPurchases", () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.form.state.values.variant).toBe("nlh");
		expect(result.current.form.state.values.chipPurchases).toEqual([]);
		expect(result.current.form.state.values.tags).toEqual([]);
	});

	it("seeds form from defaultValues", () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit,
					defaultValues: {
						name: "Main",
						variant: "nlh",
						buyIn: 100,
						entryFee: 10,
						startingStack: 20_000,
						bountyAmount: 50,
						tableSize: 9,
						currencyId: "c1",
						memo: "note",
						tags: ["deep", "weekly"],
						chipPurchases: [{ name: "Rebuy", cost: 50, chips: 10_000 }],
					},
				}),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.form.state.values.name).toBe("Main");
		expect(result.current.form.state.values.buyIn).toBe("100");
		expect(result.current.form.state.values.tableSize).toBe("9");
		expect(result.current.form.state.values.chipPurchases).toHaveLength(1);
		expect(result.current.form.state.values.chipPurchases[0]).toEqual(
			expect.objectContaining({
				name: "Rebuy",
				cost: "50",
				chips: "10000",
			})
		);
	});

	it("rejects submit with empty name", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("submits with parsed numbers and optional fields collapsed", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.form.setFieldValue("name", "Main");
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("tableSize", "9");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Main",
				buyIn: 100,
				tableSize: 9,
				memo: undefined,
				currencyId: undefined,
			})
		);
	});

	it("converts chipPurchases cost/chips to numbers on submit", async () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit,
					defaultValues: {
						name: "Main",
						variant: "nlh",
						chipPurchases: [{ name: "Rebuy", cost: 50, chips: 10_000 }],
					},
				}),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				chipPurchases: [{ name: "Rebuy", cost: 50, chips: 10_000 }],
			})
		);
	});

	it("exposes the currency list from cache", () => {
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "Chips" }]);
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([{ id: "c1", name: "Chips" }]);
	});
});
