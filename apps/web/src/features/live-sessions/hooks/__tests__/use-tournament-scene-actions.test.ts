import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const tournamentHookMocks = vi.hoisted(() => ({
	isUpdateWithLevelsPending: false,
}));

const trpcMocks = vi.hoisted(() => ({
	updateWithLevels: vi.fn(),
}));

vi.mock("@/features/stores/hooks/use-tournaments", () => ({
	useTournaments: () => ({
		isUpdateWithLevelsPending: tournamentHookMocks.isUpdateWithLevelsPending,
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "getById", input),
				}),
			},
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByStore", input),
				}),
			},
		},
		blindLevel: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("blindLevel", "listByTournament", input),
				}),
			},
		},
		tournamentChipPurchase: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey(
						"tournamentChipPurchase",
						"listByTournament",
						input
					),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			updateWithLevels: { mutate: trpcMocks.updateWithLevels },
		},
	},
}));

import { useTournamentSceneActions } from "@/features/live-sessions/hooks/use-tournament-scene-actions";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

const ARGS = {
	sessionId: "s1",
	storeId: "store-1",
	tournamentId: "t1",
};

const FORM_VALUES = {
	name: "Main Event",
	variant: "NLH",
	buyIn: 10_000,
	entryFee: 1000,
	startingStack: 20_000,
	tableSize: 9,
	currencyId: "c1",
	tags: ["a"],
	chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
};

const LEVELS = [
	{
		id: "bl1",
		level: 1,
		tournamentId: "t1",
		isBreak: false,
		blind1: 100,
		blind2: 200,
		blind3: null,
		ante: null,
		minutes: 15,
	},
	{
		id: "bl2",
		level: 2,
		tournamentId: "t1",
		isBreak: true,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: 5,
	},
];

describe("useTournamentSceneActions", () => {
	beforeEach(() => {
		trpcMocks.updateWithLevels.mockReset();
		tournamentHookMocks.isUpdateWithLevelsPending = false;
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts closed, not saving, and passes through isUpdateWithLevelsPending", () => {
		tournamentHookMocks.isUpdateWithLevelsPending = true;
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.isSaving).toBe(false);
		expect(result.current.isUpdateWithLevelsPending).toBe(true);
	});

	it("setIsEditOpen toggles isEditOpen", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		expect(result.current.isEditOpen).toBe(true);
		act(() => {
			result.current.setIsEditOpen(false);
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("handleSave calls updateWithLevels with the full payload and closes editor on success", async () => {
		trpcMocks.updateWithLevels.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		await act(async () => {
			await result.current.handleSave(FORM_VALUES, LEVELS);
		});
		expect(trpcMocks.updateWithLevels).toHaveBeenCalledWith({
			id: "t1",
			name: "Main Event",
			variant: "NLH",
			buyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			bountyAmount: null,
			tableSize: 9,
			currencyId: "c1",
			memo: null,
			tags: ["a"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			blindLevels: [
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
					minutes: 15,
				},
				{
					isBreak: true,
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
					minutes: 5,
				},
			],
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("defaults optional form values to null when omitted (?? null branch)", async () => {
		trpcMocks.updateWithLevels.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await result.current.handleSave(
				{
					name: "X",
					variant: "NLH",
					tags: [],
					chipPurchases: [],
				},
				[]
			);
		});
		expect(trpcMocks.updateWithLevels).toHaveBeenCalledWith(
			expect.objectContaining({
				buyIn: null,
				entryFee: null,
				startingStack: null,
				bountyAmount: null,
				tableSize: null,
				currencyId: null,
				memo: null,
				blindLevels: [],
			})
		);
	});

	it("flips isSaving to true during save and false afterwards", async () => {
		let resolve: ((v: unknown) => void) | undefined;
		trpcMocks.updateWithLevels.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		// Kick off handleSave without awaiting so we can observe the in-flight state.
		let savePromise: Promise<unknown> | undefined;
		act(() => {
			savePromise = result.current.handleSave(FORM_VALUES, LEVELS);
		});
		await waitFor(() => expect(result.current.isSaving).toBe(true));
		resolve?.({ id: "t1" });
		await act(async () => {
			await savePromise;
		});
		expect(result.current.isSaving).toBe(false);
	});

	it("clears isSaving even when updateWithLevels rejects (try/finally branch)", async () => {
		trpcMocks.updateWithLevels.mockRejectedValue(new Error("nope"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await expect(
				result.current.handleSave(FORM_VALUES, LEVELS)
			).rejects.toThrow("nope");
		});
		expect(result.current.isSaving).toBe(false);
	});

	it("invalidates the five target caches on success", async () => {
		trpcMocks.updateWithLevels.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await result.current.handleSave(FORM_VALUES, LEVELS);
		});
		const keys = invalidateSpy.mock.calls.map((c) =>
			JSON.stringify(c[0]?.queryKey ?? [])
		);
		expect(keys).toContain(
			JSON.stringify(["tournament", "getById", { id: "t1" }])
		);
		expect(keys).toContain(
			JSON.stringify([
				"tournament",
				"listByStore",
				{ storeId: "store-1", includeArchived: false },
			])
		);
		expect(keys).toContain(
			JSON.stringify(["blindLevel", "listByTournament", { tournamentId: "t1" }])
		);
		expect(keys).toContain(
			JSON.stringify([
				"tournamentChipPurchase",
				"listByTournament",
				{ tournamentId: "t1" },
			])
		);
		expect(keys).toContain(
			JSON.stringify(["liveTournamentSession", "getById", { id: "s1" }])
		);
	});
});
