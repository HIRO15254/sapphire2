import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const hoisted = vi.hoisted(() => ({
	useTournaments: vi.fn(),
	archive: vi.fn(),
	restore: vi.fn(),
	del: vi.fn(),
	createWithLevels: vi.fn(),
	updateWithLevels: vi.fn(),
}));

vi.mock("@/features/stores/hooks/use-tournaments", () => ({
	useTournaments: hoisted.useTournaments,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByStore", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		blindLevel: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("blindLevel", "listByTournament", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			createWithLevels: { mutate: hoisted.createWithLevels },
			updateWithLevels: { mutate: hoisted.updateWithLevels },
		},
	},
}));

import {
	useBlindStructureSummary,
	useTournamentTab,
} from "@/features/stores/components/tournament-tab/use-tournament-tab";
import type { Tournament } from "@/features/stores/hooks/use-tournaments";

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

function baseUseTournamentsStub() {
	return {
		activeTournaments: [],
		archivedTournaments: [],
		currencies: [],
		activeLoading: false,
		archivedLoading: false,
		archive: hoisted.archive,
		restore: hoisted.restore,
		delete: hoisted.del,
	};
}

const TOURNAMENT: Tournament = {
	id: "t1",
	storeId: "s1",
	name: "Main",
	variant: "nlh",
	buyIn: 100,
	entryFee: 10,
	startingStack: 20_000,
	bountyAmount: null,
	chipPurchases: [],
	tableSize: 9,
	currencyId: null,
	memo: null,
	tags: [],
	archivedAt: null,
	blindLevelCount: 0,
	createdAt: "",
	updatedAt: "",
};

describe("useTournamentTab", () => {
	beforeEach(() => {
		hoisted.createWithLevels.mockReset();
		hoisted.updateWithLevels.mockReset();
		hoisted.useTournaments.mockReturnValue(baseUseTournamentsStub());
	});

	it("starts closed with no editing tournament", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		expect(result.current.showArchived).toBe(false);
		expect(result.current.isCreateOpen).toBe(false);
		expect(result.current.editingTournament).toBeNull();
		expect(result.current.isCreateLoading).toBe(false);
		expect(result.current.isUpdateLoading).toBe(false);
	});

	it("setEditingTournament exposes editInitialFormValues derived from the tournament", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setEditingTournament(TOURNAMENT);
		});
		expect(result.current.editingTournament).toBe(TOURNAMENT);
		expect(result.current.editInitialFormValues?.name).toBe("Main");
	});

	it("handleCreate calls trpcClient.tournament.createWithLevels and closes the create dialog", async () => {
		hoisted.createWithLevels.mockResolvedValue(undefined);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setIsCreateOpen(true);
		});
		await act(async () => {
			await result.current.handleCreate(
				{
					name: "Main",
					variant: "nlh",
					chipPurchases: [],
				},
				[]
			);
		});
		expect(hoisted.createWithLevels).toHaveBeenCalledWith(
			expect.objectContaining({ storeId: "s1", name: "Main", variant: "nlh" })
		);
		await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
	});

	it("handleCreate clears isCreateLoading even when mutation fails", async () => {
		hoisted.createWithLevels.mockRejectedValue(new Error("server"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await expect(
				result.current.handleCreate(
					{ name: "Main", variant: "nlh", chipPurchases: [] },
					[]
				)
			).rejects.toThrow("server");
		});
		expect(result.current.isCreateLoading).toBe(false);
	});

	it("handleUpdate is a no-op when no tournament is being edited", async () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.handleUpdate(
				{ name: "x", variant: "nlh", chipPurchases: [] },
				[]
			);
		});
		expect(hoisted.updateWithLevels).not.toHaveBeenCalled();
	});

	it("handleUpdate calls updateWithLevels and clears editingTournament on success", async () => {
		hoisted.updateWithLevels.mockResolvedValue(undefined);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setEditingTournament(TOURNAMENT);
		});
		await act(async () => {
			await result.current.handleUpdate(
				{ name: "New", variant: "nlh", chipPurchases: [] },
				[]
			);
		});
		expect(hoisted.updateWithLevels).toHaveBeenCalledWith(
			expect.objectContaining({ id: "t1", name: "New" })
		);
		expect(result.current.editingTournament).toBeNull();
	});
});

describe("useBlindStructureSummary", () => {
	it("returns cached levels for the given tournamentId", () => {
		const qc = createClient();
		qc.setQueryData(
			["blindLevel", "listByTournament", { tournamentId: "t1" }],
			[{ id: "l1", level: 1 }]
		);
		const { result } = renderHook(() => useBlindStructureSummary("t1"), {
			wrapper: wrapper(qc),
		});
		expect(result.current.levels).toHaveLength(1);
	});

	it("returns empty array when no cache", () => {
		const qc = createClient();
		const { result } = renderHook(() => useBlindStructureSummary("t2"), {
			wrapper: wrapper(qc),
		});
		expect(result.current.levels).toEqual([]);
	});
});
