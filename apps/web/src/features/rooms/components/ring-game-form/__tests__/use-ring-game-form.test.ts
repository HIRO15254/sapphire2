import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const gameVariantsMocks = vi.hoisted(() => ({
	variants: [] as Array<{
		blindLabel1: string | null;
		blindLabel2: string | null;
		blindLabel3: string | null;
		id: string;
		name: string;
	}>,
}));

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

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

import { useRingGameForm } from "@/features/rooms/components/ring-game-form/use-ring-game-form";

const NLH_VARIANT = {
	id: "v-nlh",
	name: "NLH",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
};
const LHE_VARIANT = {
	id: "v-lhe",
	name: "LHE",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: null,
};
const PLO_VARIANT = {
	id: "v-plo",
	name: "PLO",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
};

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
	describe("variant options", () => {
		it("exposes the user's variants for the Select", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.variants).toEqual([NLH_VARIANT, PLO_VARIANT]);
		});
	});

	describe("default variantId selection", () => {
		it("create mode (no defaultValues): defaults to the first variant", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.form.state.values.variantId).toBe("v-nlh");
		});

		it("create mode: defaults to empty string when there are no variants yet", () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.form.state.values.variantId).toBe("");
		});

		it("edit mode: matches the game's variant text case-insensitively", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useRingGameForm({
						onSubmit,
						defaultValues: { name: "1/2", variant: "plo" },
					}),
				{ wrapper: wrapper(qc) }
			);
			expect(result.current.form.state.values.variantId).toBe("v-plo");
		});

		it("edit mode: falls back to the game's stored variantId when the text doesn't match any variant", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useRingGameForm({
						onSubmit,
						defaultValues: {
							name: "1/2",
							variant: "Renamed Variant",
							variantId: "v-plo",
						},
					}),
				{ wrapper: wrapper(qc) }
			);
			expect(result.current.form.state.values.variantId).toBe("v-plo");
		});

		it("edit mode: falls back to empty string when neither the text nor variantId match", () => {
			gameVariantsMocks.variants = [NLH_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useRingGameForm({
						onSubmit,
						defaultValues: { name: "1/2", variant: "Unknown" },
					}),
				{ wrapper: wrapper(qc) }
			);
			expect(result.current.form.state.values.variantId).toBe("");
		});
	});

	describe("blindLabels", () => {
		it("resolves blind labels from the default-selected variant", () => {
			gameVariantsMocks.variants = [LHE_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.blindLabels).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: null,
			});
		});

		it("falls back to SB/BB/Straddle when no variants are loaded", () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.blindLabels).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: "Straddle",
			});
		});
	});

	describe("form field defaults", () => {
		it("defaults anteType to none, empty strings elsewhere", () => {
			gameVariantsMocks.variants = [NLH_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.form.state.values.anteType).toBe("none");
			expect(result.current.form.state.values.name).toBe("");
			expect(result.current.form.state.values.blind1).toBe("");
		});

		it("seeds form from defaultValues", () => {
			gameVariantsMocks.variants = [NLH_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useRingGameForm({
						onSubmit,
						defaultValues: {
							name: "1/2 NLH",
							variant: "NLH",
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
				variantId: "v-nlh",
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
	});

	describe("submit", () => {
		it("rejects submit with empty name", async () => {
			gameVariantsMocks.variants = [NLH_VARIANT];
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

		it("rejects submit with no variant selected", async () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			act(() => {
				result.current.form.setFieldValue("name", "1/2");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).not.toHaveBeenCalled();
		});

		it("includes the resolved variant name and variantId in the payload", async () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			act(() => {
				result.current.form.setFieldValue("name", "1/2");
				result.current.form.setFieldValue("variantId", "v-plo");
			});
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ variant: "PLO", variantId: "v-plo" })
			);
		});

		it("falls back to the default-values variant text when the selected id has no match", async () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useRingGameForm({
						onSubmit,
						defaultValues: { name: "1/2", variant: "PLO8", variantId: "gv-1" },
					}),
				{ wrapper: wrapper(qc) }
			);
			await act(async () => {
				await result.current.form.handleSubmit();
			});
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({ variant: "PLO8", variantId: "gv-1" })
			);
		});

		it("submits with ante undefined when anteType is 'none'", async () => {
			gameVariantsMocks.variants = [NLH_VARIANT];
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
			gameVariantsMocks.variants = [NLH_VARIANT];
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
	});

	it("exposes the currency list from the query cache", () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "Chips" }]);
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([{ id: "c1", name: "Chips" }]);
	});
});
