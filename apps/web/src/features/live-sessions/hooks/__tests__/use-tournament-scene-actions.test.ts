import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	updateSnapshot: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
		},
	},
	trpcClient: {
		liveTournamentSession: {
			updateSnapshot: { mutate: trpcMocks.updateSnapshot },
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
		games: null,
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
		games: null,
	},
];

describe("useTournamentSceneActions", () => {
	beforeEach(() => {
		trpcMocks.updateSnapshot.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("starts closed and not saving", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isEditOpen).toBe(false);
		expect(result.current.isSaving).toBe(false);
		expect(result.current.isUpdateWithLevelsPending).toBe(false);
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

	it("handleSave writes session snapshot fields (not the master) and closes the editor", async () => {
		trpcMocks.updateSnapshot.mockResolvedValue({ id: "s1" });
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
		expect(trpcMocks.updateSnapshot).toHaveBeenCalledWith({
			id: "s1",
			ruleName: "Main Event",
			variant: "NLH",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			bountyAmount: null,
			tableSize: 9,
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			blindLevels: [
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
					minutes: 15,
					games: null,
				},
				{
					isBreak: true,
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
					minutes: 5,
					games: null,
				},
			],
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("defaults optional form values to null when omitted (?? null branch)", async () => {
		trpcMocks.updateSnapshot.mockResolvedValue({ id: "s1" });
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
		expect(trpcMocks.updateSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentBuyIn: null,
				entryFee: null,
				startingStack: null,
				bountyAmount: null,
				tableSize: null,
				blindLevels: [],
				chipPurchases: [],
			})
		);
	});

	it("flips isSaving to true during save and false afterwards", async () => {
		let resolve: ((v: unknown) => void) | undefined;
		trpcMocks.updateSnapshot.mockImplementation(
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
		resolve?.({ id: "s1" });
		await act(async () => {
			await savePromise;
		});
		expect(result.current.isSaving).toBe(false);
	});

	it("clears isSaving even when updateSnapshot rejects", async () => {
		trpcMocks.updateSnapshot.mockRejectedValue(new Error("nope"));
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

	it("invalidates the live tournament session cache on settled", async () => {
		trpcMocks.updateSnapshot.mockResolvedValue({ id: "s1" });
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
			JSON.stringify(["liveTournamentSession", "getById", { id: "s1" }])
		);
	});
});
