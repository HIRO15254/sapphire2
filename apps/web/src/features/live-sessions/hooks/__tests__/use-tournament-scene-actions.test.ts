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
	tournamentUpdate: vi.fn(),
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
			update: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "update", input),
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
		liveSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveSession", "getById", input),
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			update: { mutate: trpcMocks.tournamentUpdate },
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
	buyIn: 10_000,
	entryFee: 1000,
	startingStack: 20_000,
	bountyAmount: 500,
	tableSize: 9,
	currencyId: "c1",
	memo: "a memo",
};

describe("useTournamentSceneActions", () => {
	beforeEach(() => {
		trpcMocks.tournamentUpdate.mockReset();
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

	it("handleSave calls tournament.update with the full payload and closes editor on success", async () => {
		trpcMocks.tournamentUpdate.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.setIsEditOpen(true);
		});
		await act(async () => {
			await result.current.handleSave(FORM_VALUES);
		});
		expect(trpcMocks.tournamentUpdate).toHaveBeenCalledWith({
			id: "t1",
			name: "Main Event",
			buyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			bountyAmount: 500,
			tableSize: 9,
			currencyId: "c1",
			memo: "a memo",
		});
		expect(result.current.isEditOpen).toBe(false);
	});

	it("defaults optional form values to null when omitted (?? null branch)", async () => {
		trpcMocks.tournamentUpdate.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await result.current.handleSave({ name: "X" });
		});
		expect(trpcMocks.tournamentUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				buyIn: null,
				entryFee: null,
				startingStack: null,
				bountyAmount: null,
				tableSize: null,
				currencyId: null,
				memo: null,
			})
		);
	});

	it("flips isSaving to true during save and false afterwards", async () => {
		let resolve: ((v: unknown) => void) | undefined;
		trpcMocks.tournamentUpdate.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		let savePromise: Promise<unknown> | undefined;
		act(() => {
			savePromise = result.current.handleSave(FORM_VALUES);
		});
		await waitFor(() => expect(result.current.isSaving).toBe(true));
		resolve?.({ id: "t1" });
		await act(async () => {
			await savePromise;
		});
		expect(result.current.isSaving).toBe(false);
	});

	it("clears isSaving even when tournament.update rejects (try/finally branch)", async () => {
		trpcMocks.tournamentUpdate.mockRejectedValue(new Error("nope"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await expect(result.current.handleSave(FORM_VALUES)).rejects.toThrow(
				"nope"
			);
		});
		expect(result.current.isSaving).toBe(false);
	});

	it("invalidates the four target caches on success", async () => {
		trpcMocks.tournamentUpdate.mockResolvedValue({ id: "t1" });
		const qc = createClient();
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(() => useTournamentSceneActions(ARGS), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			await result.current.handleSave(FORM_VALUES);
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
			JSON.stringify([
				"tournamentChipPurchase",
				"listByTournament",
				{ tournamentId: "t1" },
			])
		);
		expect(keys).toContain(
			JSON.stringify(["liveSession", "getById", { id: "s1" }])
		);
	});
});
