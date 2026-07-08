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

import { useTournamentForm } from "@/features/rooms/components/tournament-modal-content/tournament-form/use-tournament-form";

const NLH_VARIANT = {
	id: "v-nlh",
	name: "NLH",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
};
const PLO_VARIANT = {
	id: "v-plo",
	name: "PLO",
	blindLabel1: "SB",
	blindLabel2: "BB",
	blindLabel3: "Straddle",
};
const STUD_VARIANT = {
	id: "v-stud",
	name: "Stud",
	blindLabel1: "Bring-in",
	blindLabel2: null,
	blindLabel3: null,
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

describe("useTournamentForm", () => {
	describe("variant options", () => {
		it("exposes the user's variants for the Select", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.variants).toEqual([NLH_VARIANT, PLO_VARIANT]);
		});
	});

	describe("default variantId selection", () => {
		it("create mode: defaults to the first variant and has no chipPurchases", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.form.state.values.variantId).toBe("v-nlh");
			expect(result.current.form.state.values.chipPurchases).toEqual([]);
			expect(result.current.form.state.values.tags).toEqual([]);
		});

		it("create mode: defaults to empty string when there are no variants yet", () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.form.state.values.variantId).toBe("");
		});

		it("edit mode: matches the tournament's variant text case-insensitively", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useTournamentForm({
						onSubmit,
						defaultValues: { name: "Main", variant: "plo" },
					}),
				{ wrapper: wrapper(qc) }
			);
			expect(result.current.form.state.values.variantId).toBe("v-plo");
		});

		it("edit mode: falls back to the tournament's stored variantId when the text doesn't match", () => {
			gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(
				() =>
					useTournamentForm({
						onSubmit,
						defaultValues: {
							name: "Main",
							variant: "Renamed",
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
					useTournamentForm({
						onSubmit,
						defaultValues: { name: "Main", variant: "Unknown" },
					}),
				{ wrapper: wrapper(qc) }
			);
			expect(result.current.form.state.values.variantId).toBe("");
		});
	});

	describe("blindLabels", () => {
		it("resolves blind labels from the default-selected variant", () => {
			gameVariantsMocks.variants = [STUD_VARIANT];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.blindLabels).toEqual({
				blind1: "Bring-in",
				blind2: null,
				blind3: null,
			});
		});

		it("falls back to SB/BB/Straddle when no variants are loaded", () => {
			gameVariantsMocks.variants = [];
			const qc = createClient();
			const onSubmit = vi.fn();
			const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
				wrapper: wrapper(qc),
			});
			expect(result.current.blindLabels).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: "Straddle",
			});
		});
	});

	it("seeds form from defaultValues", () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit,
					defaultValues: {
						name: "Main",
						variant: "NLH",
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
		expect(result.current.form.state.values.variantId).toBe("v-nlh");
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
		gameVariantsMocks.variants = [NLH_VARIANT];
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

	it("calls onInvalidSubmit (and not onSubmit) when submit fails validation", async () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		const onInvalidSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit, onInvalidSubmit }),
			{ wrapper: wrapper(qc) }
		);
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onInvalidSubmit).toHaveBeenCalledTimes(1);
	});

	it("does not call onInvalidSubmit when submit succeeds", async () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		const onInvalidSubmit = vi.fn();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit, onInvalidSubmit }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.form.setFieldValue("name", "Main");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onInvalidSubmit).not.toHaveBeenCalled();
	});

	it("submits with parsed numbers, optional fields collapsed, and the resolved variant", async () => {
		gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.form.setFieldValue("name", "Main");
			result.current.form.setFieldValue("buyIn", "100");
			result.current.form.setFieldValue("tableSize", "9");
			result.current.form.setFieldValue("variantId", "v-plo");
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
				variant: "PLO",
				variantId: "v-plo",
			})
		);
	});

	it("falls back to the default-values variant text when the selected id has no match", async () => {
		gameVariantsMocks.variants = [];
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit,
					defaultValues: { name: "Main", variant: "PLO8", variantId: "gv-1" },
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

	it("converts chipPurchases cost/chips to numbers on submit", async () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit,
					defaultValues: {
						name: "Main",
						variant: "NLH",
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

	it("registers a getter returning the current form values mapped to numbers, with the resolved variant", () => {
		gameVariantsMocks.variants = [NLH_VARIANT, PLO_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		let getter: (() => Record<string, unknown>) | undefined;
		const onRegisterLiveValues = vi.fn((fn: () => Record<string, unknown>) => {
			getter = fn;
		});
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit, onRegisterLiveValues }),
			{ wrapper: wrapper(qc) }
		);
		expect(onRegisterLiveValues).toHaveBeenCalledTimes(1);
		act(() => {
			result.current.form.setFieldValue("name", "Live Name");
			result.current.form.setFieldValue("buyIn", "150");
			result.current.form.setFieldValue("tableSize", "8");
			result.current.form.setFieldValue("variantId", "v-plo");
		});
		const snapshot = getter?.();
		expect(snapshot).toMatchObject({
			name: "Live Name",
			variant: "PLO",
			variantId: "v-plo",
			buyIn: 150,
			tableSize: 8,
		});
	});

	it("maps blank numeric form fields to undefined in the registered getter", () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		const onSubmit = vi.fn();
		let getter: (() => Record<string, unknown>) | undefined;
		const onRegisterLiveValues = (fn: () => Record<string, unknown>) => {
			getter = fn;
		};
		renderHook(() => useTournamentForm({ onSubmit, onRegisterLiveValues }), {
			wrapper: wrapper(qc),
		});
		const snapshot = getter?.();
		expect(snapshot).toMatchObject({
			name: "",
			buyIn: undefined,
			entryFee: undefined,
			startingStack: undefined,
			tableSize: undefined,
		});
	});

	it("exposes the currency list from cache", () => {
		gameVariantsMocks.variants = [NLH_VARIANT];
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "Chips" }]);
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([{ id: "c1", name: "Chips" }]);
	});
});
