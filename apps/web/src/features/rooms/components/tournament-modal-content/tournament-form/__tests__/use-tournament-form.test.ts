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
		gameGroup: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("gameGroup", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		gameVariant: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("gameVariant", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		gameMix: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("gameMix", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
}));

import { useTournamentForm } from "@/features/rooms/components/tournament-modal-content/tournament-form/use-tournament-form";

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
	it("defaults variant to the seeded NLH label and has no chipPurchases", () => {
		const qc = createClient();
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.form.state.values.variant).toBe("NL Hold'em");
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

	it("calls onInvalidSubmit (and not onSubmit) when submit fails validation", async () => {
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

	it("registers a getter returning the current form values mapped to numbers", () => {
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
		});
		const snapshot = getter?.();
		expect(snapshot).toMatchObject({
			name: "Live Name",
			variant: "NL Hold'em",
			buyIn: 150,
			tableSize: 8,
		});
	});

	it("maps blank numeric form fields to undefined in the registered getter", () => {
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
		const qc = createClient();
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "Chips" }]);
		const onSubmit = vi.fn();
		const { result } = renderHook(() => useTournamentForm({ onSubmit }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.currencies).toEqual([{ id: "c1", name: "Chips" }]);
	});
});

describe("useTournamentForm — variant scope", () => {
	it("derives 'perLevel' only from the per-level sentinel value", () => {
		const qc = createClient();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit: vi.fn() }),
			{ wrapper: wrapper(qc) }
		);
		expect(result.current.scopeOf("mix")).toBe("perLevel");
		expect(result.current.scopeOf(" MIX ")).toBe("perLevel");
		expect(result.current.scopeOf("8-Game")).toBe("all");
		expect(result.current.scopeOf("NL Hold'em")).toBe("all");
	});

	it("switching to per-level freezes the sentinel and notifies the parent", () => {
		const qc = createClient();
		const onVariantChange = vi.fn();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit: vi.fn(), onVariantChange }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.onScopeChange("perLevel", "NL Hold'em");
		});
		expect(result.current.form.state.values.variant).toBe("mix");
		expect(onVariantChange).toHaveBeenCalledTimes(1);
		expect(onVariantChange).toHaveBeenNthCalledWith(1, "mix");
	});

	it("switching back restores the variant remembered from the last switch", () => {
		const qc = createClient();
		const onVariantChange = vi.fn();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit: vi.fn(), onVariantChange }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.onScopeChange("perLevel", "8-Game");
		});
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(result.current.form.state.values.variant).toBe("8-Game");
		expect(onVariantChange).toHaveBeenNthCalledWith(2, "8-Game");
	});

	it("switching back falls back to the default label without a remembered variant", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useTournamentForm({
					onSubmit: vi.fn(),
					defaultValues: { name: "Main", variant: "mix" },
				}),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(result.current.form.state.values.variant).toBe("NL Hold'em");
	});

	it("onVariantFieldChange sets the field and notifies the parent", () => {
		const qc = createClient();
		const onVariantChange = vi.fn();
		const { result } = renderHook(
			() => useTournamentForm({ onSubmit: vi.fn(), onVariantChange }),
			{ wrapper: wrapper(qc) }
		);
		act(() => {
			result.current.onVariantFieldChange("Razz");
		});
		expect(result.current.form.state.values.variant).toBe("Razz");
		expect(onVariantChange).toHaveBeenNthCalledWith(1, "Razz");
	});
});
