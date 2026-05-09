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
	create: vi.fn(),
	update: vi.fn(),
	addBlindLevel: vi.fn(),
	addTag: vi.fn(),
	createChipPurchase: vi.fn(),
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
			listBlindLevels: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listBlindLevels", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		tournament: {
			create: { mutate: hoisted.create },
			update: { mutate: hoisted.update },
			addBlindLevel: { mutate: hoisted.addBlindLevel },
			addTag: { mutate: hoisted.addTag },
		},
		tournamentChipPurchase: {
			create: { mutate: hoisted.createChipPurchase },
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
	variantId: null,
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
		for (const m of Object.values(hoisted)) {
			if (typeof m.mockReset === "function") {
				m.mockReset();
			}
		}
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

	it("handleCreate calls tournament.create and closes the create dialog on success", async () => {
		hoisted.create.mockResolvedValue({ id: "t-new" });
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
					chipPurchases: [],
				},
				[]
			);
		});
		expect(hoisted.create).toHaveBeenCalledWith(
			expect.objectContaining({ storeId: "s1", name: "Main" })
		);
		await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
	});

	it("handleCreate clears isCreateLoading even when mutation fails", async () => {
		hoisted.create.mockRejectedValue(new Error("server"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await expect(
				result.current.handleCreate({ name: "Main", chipPurchases: [] }, [])
			).rejects.toThrow("server");
		});
		expect(result.current.isCreateLoading).toBe(false);
	});

	it("handleCreate calls addBlindLevel for each level", async () => {
		hoisted.create.mockResolvedValue({ id: "t-new" });
		hoisted.addBlindLevel.mockResolvedValue(undefined);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.handleCreate({ name: "T", chipPurchases: [] }, [
				{
					id: "l1",
					tournamentId: "t-new",
					level: 1,
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
					minutes: 20,
				},
			]);
		});
		expect(hoisted.addBlindLevel).toHaveBeenCalledWith(
			expect.objectContaining({
				tournamentId: "t-new",
				levelIndex: 0,
				isBreak: false,
				minutes: 20,
				sortOrder: 0,
			})
		);
	});

	it("handleUpdate is a no-op when no tournament is being edited", async () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.handleUpdate({ name: "x", chipPurchases: [] }, []);
		});
		expect(hoisted.update).not.toHaveBeenCalled();
	});

	it("handleUpdate calls tournament.update and clears editingTournament on success", async () => {
		hoisted.update.mockResolvedValue(undefined);
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setEditingTournament(TOURNAMENT);
		});
		await act(async () => {
			await result.current.handleUpdate({ name: "New", chipPurchases: [] }, []);
		});
		expect(hoisted.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: "t1", name: "New" })
		);
		expect(result.current.editingTournament).toBeNull();
	});

	it("handleUpdate clears isUpdateLoading even when update fails", async () => {
		hoisted.update.mockRejectedValue(new Error("fail"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ storeId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setEditingTournament(TOURNAMENT);
		});
		await act(async () => {
			await expect(
				result.current.handleUpdate({ name: "N", chipPurchases: [] }, [])
			).rejects.toThrow("fail");
		});
		expect(result.current.isUpdateLoading).toBe(false);
	});
});

describe("useBlindStructureSummary", () => {
	it("returns cached levels for the given tournamentId", () => {
		const qc = createClient();
		qc.setQueryData(
			["tournament", "listBlindLevels", { tournamentId: "t1" }],
			[
				{
					id: 1,
					tournamentId: "t1",
					levelIndex: 0,
					isBreak: false,
					minutes: 20,
					sortOrder: 0,
					blindSets: [{ blind1: 100, blind2: 200, blind3: null, ante: null }],
				},
			]
		);
		const { result } = renderHook(() => useBlindStructureSummary("t1"), {
			wrapper({ children }: { children: ReactNode }) {
				return createElement(QueryClientProvider, { client: qc }, children);
			},
		});
		expect(result.current.levels).toHaveLength(1);
		expect(result.current.levels[0]?.blind1).toBe(100);
		expect(result.current.levels[0]?.level).toBe(1);
	});

	it("returns empty array when no cache", () => {
		const qc = createClient();
		const { result } = renderHook(() => useBlindStructureSummary("t2"), {
			wrapper({ children }: { children: ReactNode }) {
				return createElement(QueryClientProvider, { client: qc }, children);
			},
		});
		expect(result.current.levels).toEqual([]);
	});
});
