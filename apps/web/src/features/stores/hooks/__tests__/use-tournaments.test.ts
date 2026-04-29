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
	tournamentCreate: vi.fn(),
	tournamentUpdate: vi.fn(),
	tournamentArchive: vi.fn(),
	tournamentRestore: vi.fn(),
	tournamentDelete: vi.fn(),
	tournamentAddTag: vi.fn(),
	tournamentRemoveTag: vi.fn(),
	createWithLevels: vi.fn(),
	updateWithLevels: vi.fn(),
	cpCreate: vi.fn(),
	cpDelete: vi.fn(),
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
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("currency", "list", undefined),
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
			create: { mutate: trpcMocks.tournamentCreate },
			update: { mutate: trpcMocks.tournamentUpdate },
			archive: { mutate: trpcMocks.tournamentArchive },
			restore: { mutate: trpcMocks.tournamentRestore },
			delete: { mutate: trpcMocks.tournamentDelete },
			addTag: { mutate: trpcMocks.tournamentAddTag },
			removeTag: { mutate: trpcMocks.tournamentRemoveTag },
			createWithLevels: { mutate: trpcMocks.createWithLevels },
			updateWithLevels: { mutate: trpcMocks.updateWithLevels },
		},
		tournamentChipPurchase: {
			create: { mutate: trpcMocks.cpCreate },
			delete: { mutate: trpcMocks.cpDelete },
		},
	},
}));

import {
	type Tournament,
	useTournaments,
} from "@/features/stores/hooks/use-tournaments";

const STORE_ID = "store-1";
const activeKey = [
	"tournament",
	"listByStore",
	{ storeId: STORE_ID, includeArchived: false },
];
const archivedKey = [
	"tournament",
	"listByStore",
	{ storeId: STORE_ID, includeArchived: true },
];

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
	return {
		id: "t1",
		name: "Main Event",
		variant: "holdem",
		storeId: STORE_ID,
		buyIn: 100,
		entryFee: 10,
		startingStack: 10_000,
		bountyAmount: null,
		tableSize: 9,
		currencyId: null,
		memo: null,
		archivedAt: null,
		blindLevelCount: 0,
		chipPurchases: [],
		tags: [],
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		...overrides,
	};
}

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

describe("useTournaments", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty lists and false pending flags when caches are empty", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.activeTournaments).toEqual([]);
			expect(result.current.archivedTournaments).toEqual([]);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isCreateWithLevelsPending).toBe(false);
			expect(result.current.isUpdateWithLevelsPending).toBe(false);
		});

		it("exposes seeded active tournaments", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [
				makeTournament({ id: "t1" }),
				makeTournament({ id: "t2", name: "Knockout" }),
			]);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() =>
				expect(result.current.activeTournaments).toHaveLength(2)
			);
		});
	});

	describe("create with tags + chipPurchases", () => {
		it("creates, then syncs added tags and chip purchases", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			trpcMocks.tournamentCreate.mockResolvedValue({ id: "t-new" });
			trpcMocks.tournamentAddTag.mockResolvedValue(undefined);
			trpcMocks.cpCreate.mockResolvedValue(undefined);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.create({
					name: "Bounty Hunter",
					variant: "holdem",
					buyIn: 50,
					tags: ["Bounty", "Weekly"],
					chipPurchases: [
						{ name: "Rebuy", cost: 50, chips: 1000 },
						{ name: "Addon", cost: 100, chips: 3000 },
					],
				});
			});
			expect(trpcMocks.tournamentCreate).toHaveBeenCalledWith({
				storeId: STORE_ID,
				name: "Bounty Hunter",
				variant: "holdem",
				buyIn: 50,
			});
			expect(trpcMocks.tournamentAddTag).toHaveBeenCalledTimes(2);
			expect(trpcMocks.tournamentAddTag).toHaveBeenCalledWith({
				tournamentId: "t-new",
				name: "Bounty",
			});
			expect(trpcMocks.tournamentAddTag).toHaveBeenCalledWith({
				tournamentId: "t-new",
				name: "Weekly",
			});
			expect(trpcMocks.cpCreate).toHaveBeenCalledTimes(2);
			expect(trpcMocks.cpCreate).toHaveBeenCalledWith({
				tournamentId: "t-new",
				name: "Rebuy",
				cost: 50,
				chips: 1000,
			});
		});

		it("does not call addTag or cpCreate when tags/chipPurchases are empty", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			trpcMocks.tournamentCreate.mockResolvedValue({ id: "t-new" });
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.create({
					name: "Freezeout",
					variant: "holdem",
					chipPurchases: [],
					tags: [],
				});
			});
			expect(trpcMocks.tournamentAddTag).not.toHaveBeenCalled();
			expect(trpcMocks.cpCreate).not.toHaveBeenCalled();
		});

		it("optimistically appends a temp tournament with normalized chip purchases during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeTournament({ id: "t1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tournamentCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.create({
					name: "New",
					variant: "holdem",
					chipPurchases: [{ name: "Rebuy", cost: 1, chips: 1 }],
					tags: ["Pending"],
				});
			});
			await waitFor(() => {
				const list = qc.getQueryData<Tournament[]>(activeKey);
				expect(list).toHaveLength(2);
				const created = list?.find((t) => t.id.startsWith("temp-tournament-"));
				expect(created?.chipPurchases).toHaveLength(1);
				expect(created?.chipPurchases[0]?.name).toBe("Rebuy");
				expect(created?.tags.map((tag) => tag.name)).toEqual(["Pending"]);
			});
			resolve?.({ id: "t-new" });
		});
	});

	describe("update with syncChipPurchases", () => {
		it("deletes existing chip purchases then re-creates new ones; diffs tags", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [
				makeTournament({
					id: "t1",
					tags: [{ id: "tag-keep", name: "Keep" }],
				}),
			]);
			trpcMocks.tournamentUpdate.mockResolvedValue({ id: "t1" });
			trpcMocks.tournamentAddTag.mockResolvedValue(undefined);
			trpcMocks.tournamentRemoveTag.mockResolvedValue(undefined);
			trpcMocks.cpCreate.mockResolvedValue(undefined);
			trpcMocks.cpDelete.mockResolvedValue(undefined);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.update({
					id: "t1",
					name: "Patched",
					variant: "holdem",
					tags: ["Keep", "Added"],
					chipPurchases: [{ name: "NewCp", cost: 5, chips: 100 }],
					existingChipPurchaseIds: ["cp-old"],
					existingTags: [
						{ id: "tag-keep", name: "Keep" },
						{ id: "tag-remove", name: "RemoveMe" },
					],
				});
			});
			expect(trpcMocks.tournamentUpdate).toHaveBeenCalledWith({
				id: "t1",
				name: "Patched",
				variant: "holdem",
			});
			// Tag diffs: add "Added", remove "RemoveMe" (Keep stays).
			expect(trpcMocks.tournamentAddTag).toHaveBeenCalledWith({
				tournamentId: "t1",
				name: "Added",
			});
			expect(trpcMocks.tournamentRemoveTag).toHaveBeenCalledWith({
				id: "tag-remove",
			});
			expect(trpcMocks.tournamentAddTag).toHaveBeenCalledTimes(1);
			expect(trpcMocks.tournamentRemoveTag).toHaveBeenCalledTimes(1);

			expect(trpcMocks.cpDelete).toHaveBeenCalledWith({ id: "cp-old" });
			expect(trpcMocks.cpCreate).toHaveBeenCalledWith({
				tournamentId: "t1",
				name: "NewCp",
				cost: 5,
				chips: 100,
			});
		});

		it("skips tag sync when tags is undefined", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeTournament({ id: "t1" })]);
			trpcMocks.tournamentUpdate.mockResolvedValue({ id: "t1" });
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.update({
					id: "t1",
					name: "X",
					variant: "holdem",
					chipPurchases: [],
					existingChipPurchaseIds: [],
					existingTags: [{ id: "tag", name: "Old" }],
				});
			});
			expect(trpcMocks.tournamentAddTag).not.toHaveBeenCalled();
			expect(trpcMocks.tournamentRemoveTag).not.toHaveBeenCalled();
		});
	});

	describe("archive / restore / delete", () => {
		it("archive moves from active to archived and sets archivedAt", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeTournament({ id: "t1" })]);
			qc.setQueryData(archivedKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tournamentArchive.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.archive("t1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<Tournament[]>(activeKey);
				const archived = qc.getQueryData<Tournament[]>(archivedKey);
				expect(active).toEqual([]);
				expect(archived?.[0]?.id).toBe("t1");
				expect(archived?.[0]?.archivedAt).not.toBeNull();
			});
			resolve?.({ id: "t1" });
		});

		it("restore moves from archived back to active with archivedAt cleared", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			qc.setQueryData(archivedKey, [
				makeTournament({ id: "t1", archivedAt: "x" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tournamentRestore.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.restore("t1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<Tournament[]>(activeKey);
				expect(active?.[0]?.id).toBe("t1");
				expect(active?.[0]?.archivedAt).toBeNull();
			});
			resolve?.({ id: "t1" });
		});

		it("delete removes from both active and archived caches", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [
				makeTournament({ id: "t1" }),
				makeTournament({ id: "t2" }),
			]);
			qc.setQueryData(archivedKey, [
				makeTournament({ id: "t1", archivedAt: "x" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.tournamentDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.delete("t1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<Tournament[]>(activeKey);
				const archived = qc.getQueryData<Tournament[]>(archivedKey);
				expect(active?.map((t) => t.id)).toEqual(["t2"]);
				expect(archived).toEqual([]);
			});
			resolve?.({ id: "t1" });
		});
	});

	describe("createWithLevels and updateWithLevels", () => {
		it("createWithLevels forwards all values + blindLevels and invalidates both lists", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.createWithLevels.mockResolvedValue({ id: "t-new" });
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.createWithLevels(
					{
						name: "Turbo",
						variant: "holdem",
						buyIn: 50,
						chipPurchases: [],
					},
					[{ isBreak: false, blind1: 1, blind2: 2 }]
				);
			});
			expect(trpcMocks.createWithLevels).toHaveBeenCalledWith(
				expect.objectContaining({
					storeId: STORE_ID,
					name: "Turbo",
					variant: "holdem",
					buyIn: 50,
					blindLevels: [{ isBreak: false, blind1: 1, blind2: 2 }],
				})
			);
			const invalidated = invalidateSpy.mock.calls.map(
				(c) => (c[0] as { queryKey: unknown[] } | undefined)?.queryKey
			);
			expect(invalidated).toEqual(
				expect.arrayContaining([activeKey, archivedKey])
			);
		});

		it("updateWithLevels additionally invalidates the blindLevel listByTournament query for the target id", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeTournament({ id: "t1" })]);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.updateWithLevels.mockResolvedValue({ id: "t1" });
			const { result } = renderHook(
				() => useTournaments({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.updateWithLevels(
					"t1",
					{
						name: "Renamed",
						variant: "holdem",
						chipPurchases: [],
					},
					[]
				);
			});
			expect(trpcMocks.updateWithLevels).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "t1",
					name: "Renamed",
					variant: "holdem",
					buyIn: null,
					entryFee: null,
					startingStack: null,
					bountyAmount: null,
					tableSize: null,
					currencyId: null,
					memo: null,
				})
			);
			const keys = invalidateSpy.mock.calls.map(
				(c) => (c[0] as { queryKey: unknown[] } | undefined)?.queryKey
			);
			expect(keys).toEqual(
				expect.arrayContaining([
					["blindLevel", "listByTournament", { tournamentId: "t1" }],
				])
			);
		});
	});
});
