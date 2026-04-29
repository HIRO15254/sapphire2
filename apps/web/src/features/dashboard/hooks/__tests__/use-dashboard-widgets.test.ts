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
	delete: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		dashboardWidget: {
			list: {
				queryOptions: (input: { device: string }) => ({
					queryKey: buildKey("dashboardWidget", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		dashboardWidget: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.delete },
		},
	},
}));

import { useDashboardWidgets } from "@/features/dashboard/hooks/use-dashboard-widgets";

const desktopKey = ["dashboardWidget", "list", { device: "desktop" }];
const mobileKey = ["dashboardWidget", "list", { device: "mobile" }];

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

function makeWidget(overrides: Record<string, unknown> = {}) {
	return {
		id: "w1",
		type: "summary_stats" as const,
		device: "desktop" as const,
		x: 0,
		y: 0,
		w: 4,
		h: 2,
		config: {},
		userId: "u1",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		...overrides,
	};
}

describe("useDashboardWidgets", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("query key parameterization by device", () => {
		it("uses the desktop queryKey when device='desktop'", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [makeWidget({ id: "d1" })]);
			qc.setQueryData(mobileKey, [makeWidget({ id: "m1", device: "mobile" })]);
			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.widgets.map((w) => w.id)).toEqual(["d1"])
			);
		});

		it("uses the mobile queryKey when device='mobile'", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [makeWidget({ id: "d1" })]);
			qc.setQueryData(mobileKey, [makeWidget({ id: "m1", device: "mobile" })]);
			const { result } = renderHook(() => useDashboardWidgets("mobile"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.widgets.map((w) => w.id)).toEqual(["m1"])
			);
		});
	});

	describe("initial state when cache is empty", () => {
		it("returns an empty widgets array", () => {
			const qc = createClient();
			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.widgets).toEqual([]);
			expect(result.current.isCreating).toBe(false);
			expect(result.current.isUpdating).toBe(false);
			expect(result.current.isDeleting).toBe(false);
			expect(result.current.error).toBeNull();
		});
	});

	describe("createWidget", () => {
		it("forwards device + type + config to trpc mutate", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, []);
			trpcMocks.create.mockResolvedValue({ id: "w-new" });

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.createWidget({
					type: "recent_sessions",
					config: { limit: 5 },
				});
			});
			expect(trpcMocks.create).toHaveBeenCalledWith({
				device: "desktop",
				type: "recent_sessions",
				config: { limit: 5 },
			});
		});

		it("forwards device + type without config when omitted", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, []);
			trpcMocks.create.mockResolvedValue({ id: "w-new" });

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.createWidget({ type: "active_session" });
			});
			expect(trpcMocks.create).toHaveBeenCalledWith({
				device: "desktop",
				type: "active_session",
				config: undefined,
			});
		});

		it("onSettled invalidates the list query", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, []);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.create.mockResolvedValue({ id: "w-new" });

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.createWidget({ type: "summary_stats" });
			});
			expect(invalidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({ queryKey: desktopKey })
			);
		});
	});

	describe("updateWidget (optimistic)", () => {
		it("optimistically patches config for the matching widget id", async () => {
			const qc = createClient();
			const widgets = [
				makeWidget({ id: "w1", config: { a: 1 } }),
				makeWidget({ id: "w2", config: { b: 2 } }),
			];
			qc.setQueryData(desktopKey, widgets);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.updateWidget({ id: "w1", config: { a: 99 } });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<ReturnType<typeof makeWidget>[]>(desktopKey);
				expect(list?.find((w) => w.id === "w1")?.config).toEqual({ a: 99 });
				expect(list?.find((w) => w.id === "w2")?.config).toEqual({ b: 2 });
			});
			resolve?.({ id: "w1" });
		});

		it("falls back to previous config when updated config is undefined", async () => {
			const qc = createClient();
			const widgets = [makeWidget({ id: "w1", config: { keep: true } })];
			qc.setQueryData(desktopKey, widgets);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.updateWidget({ id: "w1" });
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<ReturnType<typeof makeWidget>[]>(desktopKey);
				expect(list?.[0]?.config).toEqual({ keep: true });
			});
			resolve?.({ id: "w1" });
		});

		it("onError restores the previous snapshot (observed before onSettled refetch)", async () => {
			const qc = createClient();
			const widgets = [makeWidget({ id: "w1", config: { v: 1 } })];
			qc.setQueryData(desktopKey, widgets);
			trpcMocks.update.mockRejectedValue(new Error("boom"));

			let snapshotAtRollback: ReturnType<typeof makeWidget>[] | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post =
						qc.getQueryData<ReturnType<typeof makeWidget>[]>(desktopKey);
					if (
						!snapshotAtRollback &&
						post?.[0]?.config &&
						"v" in post[0].config &&
						(post[0].config as Record<string, unknown>).v === 1
					) {
						// Rollback restored the original array shape.
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(
					result.current.updateWidget({ id: "w1", config: { v: 99 } })
				).rejects.toThrow("boom");
			});
			expect(snapshotAtRollback?.[0]?.config).toEqual({ v: 1 });
		});
	});

	describe("deleteWidget (optimistic)", () => {
		it("optimistically removes the matching widget", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [
				makeWidget({ id: "w1" }),
				makeWidget({ id: "w2" }),
			]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.deleteWidget("w1");
			});
			await waitFor(() => {
				const list =
					qc.getQueryData<ReturnType<typeof makeWidget>[]>(desktopKey);
				expect(list?.map((w) => w.id)).toEqual(["w2"]);
			});
			resolve?.({ id: "w1" });
		});

		it("onError restores the snapshot (observed before onSettled refetch)", async () => {
			const qc = createClient();
			const widgets = [makeWidget({ id: "w1" }), makeWidget({ id: "w2" })];
			qc.setQueryData(desktopKey, widgets);
			trpcMocks.delete.mockRejectedValue(new Error("boom"));

			let snapshotAtRollback: ReturnType<typeof makeWidget>[] | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post =
						qc.getQueryData<ReturnType<typeof makeWidget>[]>(desktopKey);
					if (!snapshotAtRollback && post?.length === 2) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await expect(result.current.deleteWidget("w1")).rejects.toThrow("boom");
			});
			expect(snapshotAtRollback?.map((w) => w.id)).toEqual(["w1", "w2"]);
		});
	});

	describe("pending flags", () => {
		it("flips isCreating while create is in-flight", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.create.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.createWidget({ type: "summary_stats" });
			});
			await waitFor(() => expect(result.current.isCreating).toBe(true));
			resolve?.({ id: "w" });
			await waitFor(() => expect(result.current.isCreating).toBe(false));
		});

		it("flips isUpdating / isDeleting while mutations are in-flight", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [makeWidget()]);
			let resolveU: ((v: unknown) => void) | undefined;
			let resolveD: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolveU = r;
					})
			);
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolveD = r;
					})
			);

			const { result } = renderHook(() => useDashboardWidgets("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.updateWidget({ id: "w1", config: { a: 1 } });
			});
			await waitFor(() => expect(result.current.isUpdating).toBe(true));
			resolveU?.({ id: "w1" });
			await waitFor(() => expect(result.current.isUpdating).toBe(false));

			act(() => {
				result.current.deleteWidget("w1");
			});
			await waitFor(() => expect(result.current.isDeleting).toBe(true));
			resolveD?.({ id: "w1" });
			await waitFor(() => expect(result.current.isDeleting).toBe(false));
		});
	});
});
