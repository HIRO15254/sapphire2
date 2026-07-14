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

vi.mock("@/features/rooms/hooks/use-tournaments", () => ({
	useTournaments: hoisted.useTournaments,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		tournament: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByRoom", input),
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

import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { Tournament } from "@/features/rooms/hooks/use-tournaments";
import { useTournamentTab } from "@/features/rooms/pages/room-detail-page/tournament-tab/use-tournament-tab";

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
	roomId: "s1",
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
		for (const m of [
			hoisted.createWithLevels,
			hoisted.updateWithLevels,
			hoisted.archive,
			hoisted.restore,
			hoisted.del,
		]) {
			m.mockReset();
		}
		hoisted.useTournaments.mockReturnValue(baseUseTournamentsStub());
	});

	it("starts closed with no editing tournament", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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
			expect.objectContaining({ roomId: "s1", name: "Main", variant: "nlh" })
		);
		await waitFor(() => expect(result.current.isCreateOpen).toBe(false));
	});

	it("handleCreate clears isCreateLoading even when mutation fails", async () => {
		hoisted.createWithLevels.mockRejectedValue(new Error("server"));
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
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

	describe("blind-level payload (levelsToPayload)", () => {
		const GAME_SET_LEVEL: BlindLevelRow = {
			id: "lv1",
			tournamentId: "t1",
			level: 1,
			isBreak: false,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: 20,
			games: [
				{
					name: "Stud",
					variants: ["Razz"],
					blind1: 400,
					blind2: 800,
					blind3: null,
					ante: null,
				},
			],
		};
		const FLAT_LEVEL: BlindLevelRow = {
			id: "lv2",
			tournamentId: "t1",
			level: 2,
			isBreak: false,
			blind1: 100,
			blind2: 200,
			blind3: null,
			ante: 25,
			minutes: 20,
			games: null,
		};

		it("handleCreate forwards per-level games for game-set levels and null for flat levels", async () => {
			hoisted.createWithLevels.mockResolvedValue(undefined);
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			await act(async () => {
				await result.current.handleCreate(
					{ name: "Mix", variant: "8-Game", chipPurchases: [] },
					[GAME_SET_LEVEL, FLAT_LEVEL]
				);
			});
			expect(hoisted.createWithLevels).toHaveBeenCalledTimes(1);
			expect(hoisted.createWithLevels).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					blindLevels: [
						expect.objectContaining({ games: GAME_SET_LEVEL.games }),
						expect.objectContaining({ games: null }),
					],
				})
			);
		});

		it("handleUpdate forwards per-level games so updateWithLevels does not wipe stored game sets", async () => {
			hoisted.updateWithLevels.mockResolvedValue(undefined);
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => {
				result.current.setEditingTournament(TOURNAMENT);
			});
			await act(async () => {
				await result.current.handleUpdate(
					{ name: "Mix", variant: "8-Game", chipPurchases: [] },
					[GAME_SET_LEVEL, FLAT_LEVEL]
				);
			});
			expect(hoisted.updateWithLevels).toHaveBeenCalledTimes(1);
			expect(hoisted.updateWithLevels).toHaveBeenNthCalledWith(
				1,
				expect.objectContaining({
					blindLevels: [
						expect.objectContaining({ games: GAME_SET_LEVEL.games }),
						expect.objectContaining({ games: null }),
					],
				})
			);
		});
	});

	it("toggleArchived flips showArchived back and forth", () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
			wrapper: wrapper(qc),
		});
		act(() => result.current.toggleArchived());
		expect(result.current.showArchived).toBe(true);
		act(() => result.current.toggleArchived());
		expect(result.current.showArchived).toBe(false);
	});

	describe("action drawer", () => {
		it("openActions sets the target; closeActions clears it", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			expect(result.current.actionsTarget).toBe(TOURNAMENT);
			act(() => result.current.closeActions());
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openEditFromActions moves the target into editingTournament", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.openEditFromActions());
			expect(result.current.editingTournament).toBe(TOURNAMENT);
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleArchiveFromActions archives the target id and closes the drawer", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.handleArchiveFromActions());
			expect(hoisted.archive).toHaveBeenCalledWith("t1");
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleRestoreFromActions restores the target id and closes the drawer", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.handleRestoreFromActions());
			expect(hoisted.restore).toHaveBeenCalledWith("t1");
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openEditFromActions is a no-op when no target is set", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openEditFromActions());
			expect(result.current.editingTournament).toBeNull();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleArchiveFromActions is a no-op when no target is set", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.handleArchiveFromActions());
			expect(hoisted.archive).not.toHaveBeenCalled();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleRestoreFromActions is a no-op when no target is set", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.handleRestoreFromActions());
			expect(hoisted.restore).not.toHaveBeenCalled();
			expect(result.current.actionsTarget).toBeNull();
		});
	});

	describe("delete confirmation", () => {
		it("openDeleteFromActions promotes the target to pendingDelete", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.openDeleteFromActions());
			expect(result.current.pendingDelete).toBe(TOURNAMENT);
			expect(result.current.actionsTarget).toBeNull();
		});

		it("openDeleteFromActions is a no-op when no target is set", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openDeleteFromActions());
			expect(result.current.pendingDelete).toBeNull();
			expect(result.current.actionsTarget).toBeNull();
		});

		it("handleConfirmDelete deletes the pending id and clears it", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.openDeleteFromActions());
			act(() => result.current.handleConfirmDelete());
			expect(hoisted.del).toHaveBeenCalledWith("t1");
			expect(result.current.pendingDelete).toBeNull();
		});

		it("cancelDelete clears the pending target without deleting", () => {
			const qc = createClient();
			const { result } = renderHook(() => useTournamentTab({ roomId: "s1" }), {
				wrapper: wrapper(qc),
			});
			act(() => result.current.openActions(TOURNAMENT));
			act(() => result.current.openDeleteFromActions());
			act(() => result.current.cancelDelete());
			expect(result.current.pendingDelete).toBeNull();
			expect(hoisted.del).not.toHaveBeenCalled();
		});
	});
});
