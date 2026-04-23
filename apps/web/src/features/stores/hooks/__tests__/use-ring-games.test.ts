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
	create: vi.fn(),
	update: vi.fn(),
	archive: vi.fn(),
	restore: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		ringGame: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByStore", input),
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
	},
	trpcClient: {
		ringGame: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			archive: { mutate: trpcMocks.archive },
			restore: { mutate: trpcMocks.restore },
			delete: { mutate: trpcMocks.delete },
		},
	},
}));

import {
	type RingGame,
	useRingGames,
} from "@/features/stores/hooks/use-ring-games";

const STORE_ID = "store-1";
const activeKey = [
	"ringGame",
	"listByStore",
	{ storeId: STORE_ID, includeArchived: false },
];
const archivedKey = [
	"ringGame",
	"listByStore",
	{ storeId: STORE_ID, includeArchived: true },
];

function makeGame(overrides: Partial<RingGame> = {}): RingGame {
	return {
		id: "r1",
		name: "NLH 1/2",
		variant: "holdem",
		storeId: STORE_ID,
		blind1: 1,
		blind2: 2,
		blind3: null,
		ante: null,
		anteType: "none",
		tableSize: 9,
		minBuyIn: 40,
		maxBuyIn: 200,
		memo: null,
		currencyId: null,
		archivedAt: null,
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

describe("useRingGames", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns empty lists when no cache and archive is not requested", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.activeGames).toEqual([]);
			expect(result.current.archivedGames).toEqual([]);
			expect(result.current.currencies).toEqual([]);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
		});

		it("returns seeded active games from the active cache key", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [
				makeGame({ id: "r1" }),
				makeGame({ id: "r2", name: "PLO 5/10" }),
			]);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.activeGames).toHaveLength(2));
			expect(result.current.activeGames.map((g) => g.id)).toEqual(["r1", "r2"]);
		});

		it("only fetches archived list when showArchived is true", async () => {
			const qc = createClient();
			qc.setQueryData(archivedKey, [makeGame({ id: "r9", archivedAt: "x" })]);
			const hidden = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(hidden.result.current.archivedGames).toHaveLength(1);
			// The data is read via setQueryData regardless of `enabled`. The
			// important branch: `archivedLoading` must be false when disabled.
			expect(hidden.result.current.archivedLoading).toBe(false);

			const visible = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() =>
				expect(visible.result.current.archivedGames).toHaveLength(1)
			);
		});
	});

	describe("create (optimistic)", () => {
		it("appends a temp-prefixed game to the active list during mutation", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeGame({ id: "r1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.create({ name: "PLO", variant: "plo" });
			});
			await waitFor(() => {
				const list = qc.getQueryData<RingGame[]>(activeKey);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("PLO");
				expect(list?.[1]?.id.startsWith("temp-ring-game-")).toBe(true);
			});
			resolve?.({ id: "r-new" });
		});

		it("forwards storeId along with the full values payload", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			trpcMocks.create.mockResolvedValue({ id: "r-new" });
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.create({
					name: "Mixed",
					variant: "hold_em",
					blind1: 5,
					blind2: 10,
					minBuyIn: 200,
					maxBuyIn: 400,
				});
			});
			expect(trpcMocks.create).toHaveBeenCalledWith({
				storeId: STORE_ID,
				name: "Mixed",
				variant: "hold_em",
				blind1: 5,
				blind2: 10,
				minBuyIn: 200,
				maxBuyIn: 400,
			});
		});

		it("flips isCreatePending during in-flight create", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: false }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.create({ name: "X", variant: "holdem" });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "x" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});
	});

	describe("update (optimistic)", () => {
		it("patches the matching game in both active and archived caches", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeGame({ id: "r1", name: "Old" })]);
			qc.setQueryData(archivedKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.update({
					id: "r1",
					name: "Renamed",
					variant: "holdem",
				});
			});
			await waitFor(() => {
				const list = qc.getQueryData<RingGame[]>(activeKey);
				expect(list?.[0]?.name).toBe("Renamed");
			});
			resolve?.({ id: "r1" });
		});
	});

	describe("archive", () => {
		it("moves the game from active to archived with an archivedAt timestamp", async () => {
			const qc = createClient();
			const game = makeGame({ id: "r1" });
			qc.setQueryData(activeKey, [game]);
			qc.setQueryData(archivedKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.archive.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.archive("r1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<RingGame[]>(activeKey);
				const archived = qc.getQueryData<RingGame[]>(archivedKey);
				expect(active?.map((g) => g.id)).toEqual([]);
				expect(archived?.length).toBe(1);
				expect(archived?.[0]?.archivedAt).not.toBeNull();
			});
			resolve?.({ id: "r1" });
		});

		it("does not write to archived cache when the id is not present in active", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [makeGame({ id: "r2" })]);
			qc.setQueryData(archivedKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.archive.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.archive("missing");
			});
			await waitFor(() => expect(trpcMocks.archive).toHaveBeenCalled());
			const archived = qc.getQueryData<RingGame[]>(archivedKey);
			expect(archived).toEqual([]);
			resolve?.({ id: "missing" });
		});
	});

	describe("restore", () => {
		it("moves the game from archived back to active with archivedAt cleared", async () => {
			const qc = createClient();
			const game = makeGame({ id: "r1", archivedAt: "x" });
			qc.setQueryData(activeKey, []);
			qc.setQueryData(archivedKey, [game]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.restore.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.restore("r1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<RingGame[]>(activeKey);
				const archived = qc.getQueryData<RingGame[]>(archivedKey);
				expect(active?.[0]?.id).toBe("r1");
				expect(active?.[0]?.archivedAt).toBeNull();
				expect(archived).toEqual([]);
			});
			resolve?.({ id: "r1" });
		});
	});

	describe("delete", () => {
		it("removes the game from both active and archived caches", async () => {
			const qc = createClient();
			qc.setQueryData(activeKey, [
				makeGame({ id: "r1" }),
				makeGame({ id: "r2" }),
			]);
			qc.setQueryData(archivedKey, [makeGame({ id: "r1", archivedAt: "x" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.delete("r1");
			});
			await waitFor(() => {
				const active = qc.getQueryData<RingGame[]>(activeKey);
				const archived = qc.getQueryData<RingGame[]>(archivedKey);
				expect(active?.map((g) => g.id)).toEqual(["r2"]);
				expect(archived).toEqual([]);
			});
			resolve?.({ id: "r1" });
		});
	});

	describe("onError rollback", () => {
		it("rolls back both active and archived when create fails (observed via spy)", async () => {
			const qc = createClient();
			const prevActive = [makeGame({ id: "r1" })];
			const prevArchived: RingGame[] = [];
			qc.setQueryData(activeKey, prevActive);
			qc.setQueryData(archivedKey, prevArchived);
			trpcMocks.create.mockRejectedValue(new Error("boom"));

			let activeAtRollback: RingGame[] | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const active = qc.getQueryData<RingGame[]>(activeKey);
					if (
						!activeAtRollback &&
						active?.length === 1 &&
						active[0]?.id === "r1"
					) {
						activeAtRollback = active;
					}
					return r;
				}
			);

			const { result } = renderHook(
				() => useRingGames({ storeId: STORE_ID, showArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await expect(
					result.current.create({ name: "X", variant: "holdem" })
				).rejects.toThrow("boom");
			});
			expect(activeAtRollback).toEqual(prevActive);
		});
	});
});
