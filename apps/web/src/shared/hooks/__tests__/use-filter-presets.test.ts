import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";

// ---------------------------------------------------------------------------
// Mock @/utils/trpc. list.queryOptions(input) builds an input-scoped queryKey
// + a queryFn forwarding { screenKey } to listQueryFn, so the real
// QueryClient can drive useQuery, seed cache entries, and refetch
// predictably per screenKey (needed for the independence assertions).
// ---------------------------------------------------------------------------

const trpcMocks = vi.hoisted(() => ({
	filterPresetCreate: vi.fn(),
	filterPresetDelete: vi.fn(),
	filterPresetSetDefault: vi.fn(),
	filterPresetClearDefault: vi.fn(),
	listQueryFn: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		filterPreset: {
			list: {
				queryOptions: (input: { screenKey: string }) => ({
					queryKey: ["filterPreset", "list", input],
					queryFn: () => trpcMocks.listQueryFn(input),
				}),
			},
		},
	},
	trpcClient: {
		filterPreset: {
			create: { mutate: trpcMocks.filterPresetCreate },
			delete: { mutate: trpcMocks.filterPresetDelete },
			setDefault: { mutate: trpcMocks.filterPresetSetDefault },
			clearDefault: { mutate: trpcMocks.filterPresetClearDefault },
		},
	},
}));

import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

const TEMP_ID_PATTERN = /^temp-/;

interface PresetRow {
	id: string;
	isDefault: boolean;
	name: string;
	payload: Record<string, unknown>;
	screenKey: string;
}

const listKey = (screenKey: string) => ["filterPreset", "list", { screenKey }];

function seedList(
	qc: ReturnType<typeof createTestQueryClient>,
	screenKey: string,
	rows: PresetRow[]
) {
	qc.setQueryData(listKey(screenKey), rows);
}

describe("useFilterPresets", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.listQueryFn.mockResolvedValue([]);
	});

	describe("initial state", () => {
		it("returns an empty presets array and null defaultPreset before the query resolves", () => {
			const qc = createTestQueryClient();
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			expect(result.current.presets).toEqual([]);
			expect(result.current.defaultPreset).toBeNull();
		});

		it("isLoading is true before the query resolves and false after", async () => {
			const qc = createTestQueryClient();
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			expect(result.current.isLoading).toBe(true);
			await waitFor(() => expect(result.current.isLoading).toBe(false));
		});

		it("all pending flags are false with no mutation in flight", () => {
			const qc = createTestQueryClient();
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			expect(result.current.isCreatePending).toBe(false);
			expect(result.current.isDeletePending).toBe(false);
			expect(result.current.isSetDefaultPending).toBe(false);
		});
	});

	describe("seeded list", () => {
		it("exposes presets seeded into the cache for the requested screenKey", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
			]);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await waitFor(() => expect(result.current.presets).toHaveLength(2));
		});

		it("defaultPreset resolves to the entry with isDefault true", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
			]);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await waitFor(() => expect(result.current.defaultPreset?.id).toBe("p2"));
		});

		it("defaultPreset is null when no seeded entry is default", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await waitFor(() => expect(result.current.presets).toHaveLength(1));
			expect(result.current.defaultPreset).toBeNull();
		});
	});

	describe("create (optimistic)", () => {
		it("optimistically appends a temp-id entry while the mutation is in flight", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.create({
					name: "New Preset",
					payload: { type: "cash_game" },
				});
			});
			await waitFor(() => {
				const list = qc.getQueryData<PresetRow[]>(listKey("sessions"));
				expect(list).toHaveLength(2);
				expect(list?.[1]?.id).toMatch(TEMP_ID_PATTERN);
				expect(list?.[1]?.name).toBe("New Preset");
				expect(list?.[1]?.payload).toEqual({ type: "cash_game" });
				expect(list?.[1]?.isDefault).toBe(false);
			});
			resolve?.({ id: "server-id" });
		});

		it("forwards screenKey, name, and payload to trpcClient.filterPreset.create.mutate", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "statistics", []);
			trpcMocks.filterPresetCreate.mockResolvedValue({ id: "server-id" });
			const { result } = renderHook(() => useFilterPresets("statistics"), {
				wrapper: withQueryClient(qc),
			});
			await act(async () => {
				await result.current.create({
					name: "Stats Preset",
					payload: { norm: "normalized" },
				});
			});
			expect(trpcMocks.filterPresetCreate).toHaveBeenCalledWith({
				screenKey: "statistics",
				name: "Stats Preset",
				payload: { norm: "normalized" },
			});
		});

		it("rolls back to the pre-mutation list when the server rejects", async () => {
			const original = [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			];
			// The onSettled invalidate refetches; mirror the rollback state so the
			// refetch reseeds with what onError restores.
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createTestQueryClient();
			seedList(qc, "sessions", original);
			trpcMocks.filterPresetCreate.mockRejectedValue(new Error("server down"));
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await act(async () => {
				await expect(
					result.current.create({ name: "Fails", payload: {} })
				).rejects.toThrow("server down");
			});
			expect(result.current.presets).toEqual(original);
		});

		it("isCreatePending flips true then false across the mutation lifecycle", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.create({ name: "Pending", payload: {} });
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolve?.({ id: "server-id" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));
		});
	});

	describe("remove (optimistic)", () => {
		it("optimistically filters out the removed preset", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.remove("p1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<PresetRow[]>(listKey("sessions"));
				expect(list?.map((p) => p.id)).toEqual(["p2"]);
			});
			resolve?.({ success: true });
		});

		it("rolls back to the pre-delete list when the server rejects", async () => {
			const original = [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createTestQueryClient();
			seedList(qc, "sessions", original);
			trpcMocks.filterPresetDelete.mockRejectedValue(new Error("server down"));
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await act(async () => {
				await expect(result.current.remove("p1")).rejects.toThrow(
					"server down"
				);
			});
			expect(result.current.presets.map((p) => p.id)).toEqual(["p1", "p2"]);
		});

		it("isDeletePending flips true then false across the mutation lifecycle", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.remove("p1");
			});
			await waitFor(() => expect(result.current.isDeletePending).toBe(true));
			resolve?.({ success: true });
			await waitFor(() => expect(result.current.isDeletePending).toBe(false));
		});
	});

	describe("setDefault (optimistic)", () => {
		it("sets exactly the target's isDefault true and every other entry's isDefault false", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
				{
					id: "p3",
					name: "C",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetSetDefault.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.setDefault("p2");
			});
			await waitFor(() => {
				const list = qc.getQueryData<PresetRow[]>(listKey("sessions"));
				expect(list?.find((p) => p.id === "p1")?.isDefault).toBe(false);
				expect(list?.find((p) => p.id === "p2")?.isDefault).toBe(true);
				expect(list?.find((p) => p.id === "p3")?.isDefault).toBe(false);
			});
			resolve?.({ id: "p2", isDefault: true });
		});

		it("rolls back the original isDefault flags when the server rejects", async () => {
			const original = [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createTestQueryClient();
			seedList(qc, "sessions", original);
			trpcMocks.filterPresetSetDefault.mockRejectedValue(
				new Error("server down")
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await act(async () => {
				await expect(result.current.setDefault("p2")).rejects.toThrow(
					"server down"
				);
			});
			expect(
				result.current.presets.map((p) => ({
					id: p.id,
					isDefault: p.isDefault,
				}))
			).toEqual([
				{ id: "p1", isDefault: true },
				{ id: "p2", isDefault: false },
			]);
		});

		it("isSetDefaultPending flips true then false across the mutation lifecycle", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetSetDefault.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.setDefault("p1");
			});
			await waitFor(() =>
				expect(result.current.isSetDefaultPending).toBe(true)
			);
			resolve?.({ id: "p1", isDefault: true });
			await waitFor(() =>
				expect(result.current.isSetDefaultPending).toBe(false)
			);
		});
	});

	describe("clearDefault (optimistic)", () => {
		it("sets only the target's isDefault false, leaving other entries untouched", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
				{
					id: "p2",
					name: "B",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetClearDefault.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			act(() => {
				result.current.clearDefault("p1");
			});
			await waitFor(() => {
				const list = qc.getQueryData<PresetRow[]>(listKey("sessions"));
				expect(list?.find((p) => p.id === "p1")?.isDefault).toBe(false);
				expect(list?.find((p) => p.id === "p2")?.isDefault).toBe(false);
			});
			resolve?.({ id: "p1", isDefault: false });
		});

		it("rolls back to the pre-mutation isDefault flag when the server rejects", async () => {
			const original = [
				{
					id: "p1",
					name: "A",
					payload: {},
					isDefault: true,
					screenKey: "sessions",
				},
			];
			trpcMocks.listQueryFn.mockResolvedValue(original);
			const qc = createTestQueryClient();
			seedList(qc, "sessions", original);
			trpcMocks.filterPresetClearDefault.mockRejectedValue(
				new Error("server down")
			);
			const { result } = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			await act(async () => {
				await expect(result.current.clearDefault("p1")).rejects.toThrow(
					"server down"
				);
			});
			expect(result.current.presets[0]?.isDefault).toBe(true);
		});
	});

	describe("cache independence across screenKey", () => {
		it("two instances with different screenKey arguments do not share cache state", async () => {
			const qc = createTestQueryClient();
			seedList(qc, "sessions", [
				{
					id: "s1",
					name: "Sessions Preset",
					payload: {},
					isDefault: false,
					screenKey: "sessions",
				},
			]);
			seedList(qc, "statistics", [
				{
					id: "t1",
					name: "Stats Preset",
					payload: {},
					isDefault: false,
					screenKey: "statistics",
				},
			]);
			const sessionsHook = renderHook(() => useFilterPresets("sessions"), {
				wrapper: withQueryClient(qc),
			});
			const statisticsHook = renderHook(() => useFilterPresets("statistics"), {
				wrapper: withQueryClient(qc),
			});
			await waitFor(() =>
				expect(sessionsHook.result.current.presets.map((p) => p.id)).toEqual([
					"s1",
				])
			);
			await waitFor(() =>
				expect(statisticsHook.result.current.presets.map((p) => p.id)).toEqual([
					"t1",
				])
			);

			// Block resolution so the optimistic (pre-invalidate) cache state is
			// observable on both instances before the mutation settles.
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.filterPresetCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			act(() => {
				sessionsHook.result.current.create({
					name: "New Sessions Preset",
					payload: {},
				});
			});

			// The sessions cache entry grew, the statistics one is unaffected.
			await waitFor(() =>
				expect(qc.getQueryData<PresetRow[]>(listKey("sessions"))).toHaveLength(
					2
				)
			);
			expect(qc.getQueryData<PresetRow[]>(listKey("statistics"))).toHaveLength(
				1
			);
			expect(statisticsHook.result.current.presets.map((p) => p.id)).toEqual([
				"t1",
			]);
			resolve?.({ id: "server-id" });
		});
	});
});
