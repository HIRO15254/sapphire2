import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks for trpc. queryOptions builds a stable queryKey keyed on the
// includeArchived input, so a real QueryClient can drive useQuery and seed
// list data predictably.
// ---------------------------------------------------------------------------

const trpcMocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	archive: vi.fn(),
	restore: vi.fn(),
	delete: vi.fn(),
	// queryFn used by useQuery(gameVariant.list). Per-test override controls
	// refetch payloads (needed for rollback assertions that survive the
	// onSettled refetch).
	listQueryFn: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		gameVariant: {
			list: {
				queryOptions: (input: { includeArchived: boolean }) => ({
					queryKey: ["gameVariant", "list", input],
					queryFn: () => trpcMocks.listQueryFn(input),
				}),
			},
		},
	},
	trpcClient: {
		gameVariant: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			archive: { mutate: trpcMocks.archive },
			restore: { mutate: trpcMocks.restore },
			delete: { mutate: trpcMocks.delete },
		},
	},
}));

import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";

const TEMP_ID_PATTERN = /^temp-/;
const LIST_KEY_ACTIVE = ["gameVariant", "list", { includeArchived: false }];
const LIST_KEY_ARCHIVED = ["gameVariant", "list", { includeArchived: true }];

interface VariantRow {
	archivedAt: Date | null;
	blindLabel1: string | null;
	blindLabel2: string | null;
	blindLabel3: string | null;
	id: string;
	name: string;
	sortOrder: number;
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

function variant(overrides: Partial<VariantRow> = {}): VariantRow {
	return {
		id: "v1",
		name: "NLH",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
		sortOrder: 0,
		archivedAt: null,
		...overrides,
	};
}

describe("useGameVariants", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.listQueryFn.mockResolvedValue([]);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("query wiring", () => {
		it("returns empty variants and isPending states when nothing is cached", () => {
			const qc = createClient();
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.variants).toEqual([]);
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isArchivePending).toBe(false);
			expect(result.current.isRestorePending).toBe(false);
			expect(result.current.isDeletePending).toBe(false);
		});

		it("queries with includeArchived: false by default (no options passed)", () => {
			const qc = createClient();
			renderHook(() => useGameVariants(), { wrapper: makeWrapper(qc) });
			expect(trpcMocks.listQueryFn).toHaveBeenCalledTimes(1);
			expect(trpcMocks.listQueryFn).toHaveBeenNthCalledWith(1, {
				includeArchived: false,
			});
		});

		it("queries with includeArchived: true when options.includeArchived is true", () => {
			const qc = createClient();
			renderHook(() => useGameVariants({ includeArchived: true }), {
				wrapper: makeWrapper(qc),
			});
			expect(trpcMocks.listQueryFn).toHaveBeenCalledTimes(1);
			expect(trpcMocks.listQueryFn).toHaveBeenNthCalledWith(1, {
				includeArchived: true,
			});
		});

		it("exposes variants seeded into the active-list cache", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO" }),
			]);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.variants).toHaveLength(2));
		});

		it("exposes variants seeded into the archived-inclusive cache when includeArchived is true", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ARCHIVED, [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO", archivedAt: new Date("2026-01-01") }),
			]);
			const { result } = renderHook(
				() => useGameVariants({ includeArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.variants).toHaveLength(2));
		});

		it("isPending reflects the initial fetch state", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.listQueryFn.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.isPending).toBe(true);
			resolve?.([]);
			await waitFor(() => expect(result.current.isPending).toBe(false));
		});
	});

	describe("onCreate (optimistic)", () => {
		it("optimistically appends a temp variant to the active-list cache", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1", name: "NLH" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});

			act(() => {
				result.current.onCreate({
					name: "PLO5",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: "Straddle",
				});
			});

			await waitFor(() => {
				const list = qc.getQueryData<VariantRow[]>(LIST_KEY_ACTIVE);
				expect(list).toHaveLength(2);
				expect(list?.[1]?.name).toBe("PLO5");
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
				expect(list?.[1]?.archivedAt).toBeNull();
				expect(list?.[1]?.sortOrder).toBe(1);
			});
			resolve?.({ id: "v2" });
		});

		it("forwards blind labels as null when omitted on the temp row", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onCreate({ name: "Short Deck" });
			});
			await waitFor(() => {
				const list = qc.getQueryData<VariantRow[]>(LIST_KEY_ACTIVE);
				expect(list?.[0]?.blindLabel1).toBeNull();
				expect(list?.[0]?.blindLabel2).toBeNull();
				expect(list?.[0]?.blindLabel3).toBeNull();
			});
			resolve?.({ id: "v-new" });
		});

		it("calls trpcClient.gameVariant.create.mutate with the exact payload", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, []);
			trpcMocks.create.mockResolvedValue({ id: "v-new" });
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onCreate({
					name: "PLO5",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: "Straddle",
				});
			});
			expect(trpcMocks.create).toHaveBeenCalledTimes(1);
			expect(trpcMocks.create).toHaveBeenNthCalledWith(1, {
				name: "PLO5",
				blindLabel1: "SB",
				blindLabel2: "BB",
				blindLabel3: "Straddle",
			});
		});

		it("onMutate: no-op when the cache is undefined (old === undefined)", async () => {
			const qc = createClient();
			// Never resolves, so the underlying list query stays unfetched
			// (cache truly undefined, not an empty array) while the mutation runs.
			trpcMocks.listQueryFn.mockImplementation(
				() =>
					new Promise(() => {
						// Intentionally never settles.
					})
			);
			trpcMocks.create.mockResolvedValue({ id: "v-new" });
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onCreate({ name: "Free" });
			});
			// The onMutate branch returns old (undefined) unchanged; no throw.
			expect(trpcMocks.create).toHaveBeenCalledTimes(1);
			expect(qc.getQueryData(LIST_KEY_ACTIVE)).toBeUndefined();
		});

		it("rolls back the optimistic insert when the server rejects", async () => {
			const original = [variant({ id: "v1", name: "NLH" })];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, original);
			trpcMocks.create.mockRejectedValue(new Error("conflict"));
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.onCreate({ name: "NLH" })).rejects.toThrow(
					"conflict"
				);
			});
			await waitFor(() => expect(result.current.variants).toEqual(original));
		});

		it("invalidates the active-list query on settle (success)", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, []);
			trpcMocks.create.mockResolvedValue({ id: "v-new" });
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onCreate({ name: "PLO" });
			});
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LIST_KEY_ACTIVE });
		});

		it("isCreatePending flips true during the in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onCreate({ name: "PLO" });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "v-new" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});
	});

	describe("onUpdate (optimistic)", () => {
		it("optimistically patches the matching variant in the cache", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onUpdate({
					id: "v1",
					name: "NLH Renamed",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: "Straddle",
				});
			});
			await waitFor(() => {
				const list = qc.getQueryData<VariantRow[]>(LIST_KEY_ACTIVE);
				expect(list?.[0]?.name).toBe("NLH Renamed");
				expect(list?.[1]?.name).toBe("PLO");
			});
			resolve?.({ id: "v1" });
		});

		it("calls trpcClient.gameVariant.update.mutate with id and the changed fields", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1", name: "NLH" })]);
			trpcMocks.update.mockResolvedValue({ id: "v1" });
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onUpdate({
					id: "v1",
					name: "NLH",
					blindLabel1: "SB",
					blindLabel2: "BB",
					blindLabel3: null,
				});
			});
			expect(trpcMocks.update).toHaveBeenCalledTimes(1);
			expect(trpcMocks.update).toHaveBeenNthCalledWith(1, {
				id: "v1",
				name: "NLH",
				blindLabel1: "SB",
				blindLabel2: "BB",
				blindLabel3: null,
			});
		});

		it("rolls back the optimistic patch when the server rejects", async () => {
			const original = [variant({ id: "v1", name: "NLH" })];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, original);
			trpcMocks.update.mockRejectedValue(new Error("server down"));
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(
					result.current.onUpdate({ id: "v1", name: "Renamed" })
				).rejects.toThrow("server down");
			});
			await waitFor(() => expect(result.current.variants[0]?.name).toBe("NLH"));
		});

		it("invalidates the active-list query on settle (success)", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1" })]);
			trpcMocks.update.mockResolvedValue({ id: "v1" });
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onUpdate({ id: "v1", name: "NLH" });
			});
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LIST_KEY_ACTIVE });
		});

		it("isUpdatePending flips true during the in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onUpdate({ id: "v1", name: "NLH" });
			});
			await waitFor(() => expect(result.current.isUpdatePending).toBe(true));
			resolve?.({ id: "v1" });
			await waitFor(() => expect(result.current.isUpdatePending).toBe(false));
		});
	});

	describe("onArchive (settle-only invalidate)", () => {
		it("calls trpcClient.gameVariant.archive.mutate with the id", async () => {
			const qc = createClient();
			trpcMocks.archive.mockResolvedValue({ id: "v1" });
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onArchive("v1");
			});
			expect(trpcMocks.archive).toHaveBeenCalledTimes(1);
			expect(trpcMocks.archive).toHaveBeenNthCalledWith(1, { id: "v1" });
		});

		it("invalidates the active-list query on settle (success)", async () => {
			const qc = createClient();
			trpcMocks.archive.mockResolvedValue({ id: "v1" });
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onArchive("v1");
			});
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LIST_KEY_ACTIVE });
		});

		it("invalidates the active-list query on settle (error) and rejects", async () => {
			const qc = createClient();
			trpcMocks.archive.mockRejectedValue(new Error("not found"));
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.onArchive("v1")).rejects.toThrow(
					"not found"
				);
			});
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: LIST_KEY_ACTIVE });
		});

		it("isArchivePending flips true during the in-flight mutation", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.archive.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onArchive("v1");
			});
			await waitFor(() => expect(result.current.isArchivePending).toBe(true));
			resolve?.({ id: "v1" });
			await waitFor(() => expect(result.current.isArchivePending).toBe(false));
		});
	});

	describe("onRestore (settle-only invalidate)", () => {
		it("calls trpcClient.gameVariant.restore.mutate with the id", async () => {
			const qc = createClient();
			trpcMocks.restore.mockResolvedValue({ id: "v1" });
			const { result } = renderHook(
				() => useGameVariants({ includeArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.onRestore("v1");
			});
			expect(trpcMocks.restore).toHaveBeenCalledTimes(1);
			expect(trpcMocks.restore).toHaveBeenNthCalledWith(1, { id: "v1" });
		});

		it("invalidates the archived-inclusive query on settle (success)", async () => {
			const qc = createClient();
			trpcMocks.restore.mockResolvedValue({ id: "v1" });
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(
				() => useGameVariants({ includeArchived: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.onRestore("v1");
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: LIST_KEY_ARCHIVED,
			});
		});

		it("isRestorePending flips true during the in-flight mutation", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.restore.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onRestore("v1");
			});
			await waitFor(() => expect(result.current.isRestorePending).toBe(true));
			resolve?.({ id: "v1" });
			await waitFor(() => expect(result.current.isRestorePending).toBe(false));
		});
	});

	describe("onDelete (optimistic)", () => {
		it("optimistically removes the variant from the cache", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onDelete("v1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<VariantRow[]>(LIST_KEY_ACTIVE);
				expect(list?.map((v) => v.id)).toEqual(["v2"]);
			});
			resolve?.({ success: true });
		});

		it("calls trpcClient.gameVariant.delete.mutate with the id", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1" })]);
			trpcMocks.delete.mockResolvedValue({ success: true });
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.onDelete("v1");
			});
			expect(trpcMocks.delete).toHaveBeenCalledTimes(1);
			expect(trpcMocks.delete).toHaveBeenNthCalledWith(1, { id: "v1" });
		});

		it("rolls back the optimistic removal when the server rejects", async () => {
			const original = [
				variant({ id: "v1", name: "NLH" }),
				variant({ id: "v2", name: "PLO" }),
			];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, original);
			trpcMocks.delete.mockRejectedValue(new Error("in use"));
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.onDelete("v1")).rejects.toThrow("in use");
			});
			await waitFor(() =>
				expect(result.current.variants.map((v) => v.id)).toEqual(["v1", "v2"])
			);
		});

		it("isDeletePending flips true during the in-flight mutation", async () => {
			const qc = createClient();
			qc.setQueryData(LIST_KEY_ACTIVE, [variant({ id: "v1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useGameVariants(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.onDelete("v1");
			});
			await waitFor(() => expect(result.current.isDeletePending).toBe(true));
			resolve?.({ success: true });
			await waitFor(() => expect(result.current.isDeletePending).toBe(false));
		});
	});
});
