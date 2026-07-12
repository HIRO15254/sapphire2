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

import { useRingGameForm } from "@/features/rooms/components/ring-game-form/use-ring-game-form";
import { updateGroup } from "@/shared/lib/mix-games";

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
			mixGames: [],
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

// Master fixture for mix-selection tests: two Big Bet variants, plus two
// named mixes referencing them in different combinations.
const GROUPS = [
	{
		id: "g-bigbet",
		builtinKey: "bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
	},
];
const VARIANTS = [
	{
		id: "v-nlh",
		builtinKey: "nlh",
		label: "NL Hold'em",
		shortLabel: "NLH",
		groupId: "g-bigbet",
		sortOrder: 0,
	},
	{
		id: "v-plo",
		builtinKey: "plo",
		label: "PL Omaha",
		shortLabel: "PLO",
		groupId: "g-bigbet",
		sortOrder: 1,
	},
];
const MIXES = [
	{
		id: "m-8game",
		builtinKey: "8-game",
		label: "8-Game",
		games: ["v-nlh", "v-plo"],
	},
	{ id: "m-horse", builtinKey: "horse", label: "HORSE", games: ["v-nlh"] },
];

function setupWithMasterData() {
	const qc = createClient();
	qc.setQueryData(["gameGroup", "list"], GROUPS);
	qc.setQueryData(["gameVariant", "list"], VARIANTS);
	qc.setQueryData(["gameMix", "list"], MIXES);
	const onSubmit = vi.fn();
	const { result } = renderHook(() => useRingGameForm({ onSubmit }), {
		wrapper: wrapper(qc),
	});
	return { result, onSubmit };
}

describe("useRingGameForm — onVariantChange mix expansion", () => {
	it("recognizes a mix master label via isMixValue", () => {
		const { result } = setupWithMasterData();
		expect(result.current.isMixValue("8-Game")).toBe(true);
		expect(result.current.isMixValue("mix")).toBe(true);
		expect(result.current.isMixValue("NL Hold'em")).toBe(false);
	});

	it("sets the variant field and seeds mixGames from the mix's composition", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		expect(result.current.form.state.values.variant).toBe("8-Game");
		expect(result.current.form.state.values.mixGames).toHaveLength(1);
		expect(result.current.form.state.values.mixGames[0].variants).toEqual([
			"NL Hold'em",
			"PL Omaha",
		]);
	});

	it("reseeds (overwrites) mixGames when switching to a different mix", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		expect(result.current.form.state.values.mixGames[0].variants).toEqual([
			"NL Hold'em",
			"PL Omaha",
		]);
		act(() => {
			result.current.onVariantChange("HORSE");
		});
		expect(result.current.form.state.values.mixGames).toHaveLength(1);
		expect(result.current.form.state.values.mixGames[0].variants).toEqual([
			"NL Hold'em",
		]);
	});

	it("does not clear existing mixGames rows when selecting the legacy 'mix' value", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		const seeded = result.current.form.state.values.mixGames;
		act(() => {
			result.current.onVariantChange("mix");
		});
		expect(result.current.form.state.values.variant).toBe("mix");
		expect(result.current.form.state.values.mixGames).toBe(seeded);
	});

	it("submits mixGames as null when the variant is a plain (non-mix) value", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.form.setFieldValue("name", "Mixed table");
			result.current.onVariantChange("8-Game");
			result.current.onVariantChange("NL Hold'em");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ variant: "NL Hold'em", mixGames: null })
		);
	});

	it("submits mixGames from the seeded composition when the variant is a mix label", async () => {
		const { result, onSubmit } = setupWithMasterData();
		act(() => {
			result.current.form.setFieldValue("name", "Mixed table");
			result.current.onVariantChange("8-Game");
		});
		await act(async () => {
			await result.current.form.handleSubmit();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				variant: "8-Game",
				mixGames: [
					expect.objectContaining({ variants: ["NL Hold'em", "PL Omaha"] }),
				],
			})
		);
	});
});

describe("useRingGameForm — mix master edit sheet", () => {
	it("resolves the master row backing a mix label, case-insensitively", () => {
		const { result } = setupWithMasterData();
		expect(result.current.mixRowFor("8-Game")?.id).toBe("m-8game");
		expect(result.current.mixRowFor("8-game")?.id).toBe("m-8game");
		expect(result.current.mixRowFor("mix")).toBeNull();
		expect(result.current.mixRowFor("NL Hold'em")).toBeNull();
	});

	it("opens the sheet with the master row for the current variant", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onEditMix("8-Game");
		});
		expect(result.current.isMixSheetOpen).toBe(true);
		expect(result.current.editingMix?.id).toBe("m-8game");
	});

	it("ignores edit requests for values without a mix master", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onEditMix("mix");
		});
		expect(result.current.isMixSheetOpen).toBe(false);
		expect(result.current.editingMix).toBeNull();
	});

	it("onMixSaved updates the variant label, reseeds the composition keeping amounts, and closes", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		const seeded = result.current.form.state.values.mixGames;
		act(() => {
			result.current.form.setFieldValue(
				"mixGames",
				updateGroup(seeded, seeded[0].uid, { blind1: "100", blind2: "200" })
			);
			result.current.onEditMix("8-Game");
		});
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game Deluxe",
				games: ["v-nlh"],
			});
		});
		expect(result.current.form.state.values.variant).toBe("8-Game Deluxe");
		const rows = result.current.form.state.values.mixGames;
		expect(rows).toHaveLength(1);
		expect(rows[0].variants).toEqual(["NL Hold'em"]);
		expect(rows[0].blind1).toBe("100");
		expect(rows[0].blind2).toBe("200");
		expect(result.current.isMixSheetOpen).toBe(false);
	});

	it("onMixSaved skips variant ids whose master row no longer exists", () => {
		const { result } = setupWithMasterData();
		act(() => {
			result.current.onVariantChange("8-Game");
		});
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game",
				games: ["v-nlh", "v-deleted"],
			});
		});
		expect(result.current.form.state.values.mixGames[0].variants).toEqual([
			"NL Hold'em",
		]);
	});

	it("exposes the variant master rows for the sheet's label mapping", () => {
		const { result } = setupWithMasterData();
		expect(result.current.variants.map((v) => v.id)).toEqual([
			"v-nlh",
			"v-plo",
		]);
	});
});
