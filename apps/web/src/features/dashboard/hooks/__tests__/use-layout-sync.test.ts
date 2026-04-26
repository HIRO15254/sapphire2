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
	updateLayouts: vi.fn(),
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
			updateLayouts: { mutate: trpcMocks.updateLayouts },
		},
	},
}));

import { useLayoutSync } from "@/features/dashboard/hooks/use-layout-sync";

const desktopKey = ["dashboardWidget", "list", { device: "desktop" }];

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

function widget(
	overrides: {
		id?: string;
		x?: number;
		y?: number;
		w?: number;
		h?: number;
	} = {}
) {
	return {
		id: overrides.id ?? "w1",
		type: "summary_stats" as const,
		device: "desktop" as const,
		x: overrides.x ?? 0,
		y: overrides.y ?? 0,
		w: overrides.w ?? 4,
		h: overrides.h ?? 2,
		config: {},
		userId: "u1",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	};
}

describe("useLayoutSync", () => {
	beforeEach(() => {
		trpcMocks.updateLayouts.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("starts with no pending changes and not syncing", () => {
			const qc = createClient();
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.hasPendingChanges).toBe(false);
			expect(result.current.isSyncing).toBe(false);
		});
	});

	describe("enqueue", () => {
		it("sets hasPendingChanges to true after enqueueing layout items", () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget()]);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 2, y: 3, w: 6, h: 4 }]);
			});
			expect(result.current.hasPendingChanges).toBe(true);
		});

		it("merges layout positions into the cached widgets list", () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [
				widget({ id: "w1", x: 0, y: 0 }),
				widget({ id: "w2", x: 1, y: 1 }),
			]);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 5, y: 7, w: 3, h: 2 }]);
			});
			const list = qc.getQueryData<ReturnType<typeof widget>[]>(desktopKey);
			expect(list?.find((w) => w.id === "w1")).toMatchObject({
				x: 5,
				y: 7,
				w: 3,
				h: 2,
			});
			// unchanged sibling
			expect(list?.find((w) => w.id === "w2")).toMatchObject({ x: 1, y: 1 });
		});

		it("does nothing to cached list when cache is empty (prev === undefined)", () => {
			const qc = createClient();
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 2, w: 3, h: 4 }]);
			});
			// hasPendingChanges still toggles true because pendingRef populates.
			expect(result.current.hasPendingChanges).toBe(true);
			expect(qc.getQueryData(desktopKey)).toBeUndefined();
		});

		it("replaces a previously queued item for the same id with the newest layout", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			trpcMocks.updateLayouts.mockResolvedValue(undefined);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
				result.current.enqueue([{ id: "w1", x: 9, y: 9, w: 9, h: 9 }]);
			});
			await act(async () => {
				await result.current.flush();
			});
			expect(trpcMocks.updateLayouts).toHaveBeenCalledWith({
				device: "desktop",
				items: [{ id: "w1", x: 9, y: 9, w: 9, h: 9 }],
			});
		});
	});

	describe("flush", () => {
		it("is a no-op when nothing is pending", async () => {
			const qc = createClient();
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.flush();
			});
			expect(trpcMocks.updateLayouts).not.toHaveBeenCalled();
		});

		it("dispatches the pending layout items and clears the pending flag", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			trpcMocks.updateLayouts.mockResolvedValue(undefined);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 3, y: 4, w: 2, h: 2 }]);
			});
			expect(result.current.hasPendingChanges).toBe(true);
			await act(async () => {
				await result.current.flush();
			});
			expect(trpcMocks.updateLayouts).toHaveBeenCalledTimes(1);
			expect(trpcMocks.updateLayouts).toHaveBeenCalledWith({
				device: "desktop",
				items: [{ id: "w1", x: 3, y: 4, w: 2, h: 2 }],
			});
			expect(result.current.hasPendingChanges).toBe(false);
		});

		it("invalidates the list on server error", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.updateLayouts.mockRejectedValue(new Error("server down"));
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
			});
			await act(async () => {
				await expect(result.current.flush()).rejects.toThrow("server down");
			});
			expect(invalidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({ queryKey: desktopKey })
			);
		});

		it("flips isSyncing while mutation is in-flight", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.updateLayouts.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
			});
			act(() => {
				result.current.flush();
			});
			await waitFor(() => expect(result.current.isSyncing).toBe(true));
			resolve?.(undefined);
			await waitFor(() => expect(result.current.isSyncing).toBe(false));
		});
	});

	describe("discard", () => {
		it("clears pending flag and invalidates the list", () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
			});
			act(() => {
				result.current.discard();
			});
			expect(result.current.hasPendingChanges).toBe(false);
			expect(invalidateSpy).toHaveBeenCalledWith(
				expect.objectContaining({ queryKey: desktopKey })
			);
		});

		it("flush after discard is a no-op", async () => {
			const qc = createClient();
			qc.setQueryData(desktopKey, [widget({ id: "w1" })]);
			const { result } = renderHook(() => useLayoutSync("desktop"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
			});
			act(() => {
				result.current.discard();
			});
			await act(async () => {
				await result.current.flush();
			});
			expect(trpcMocks.updateLayouts).not.toHaveBeenCalled();
		});
	});

	describe("device parameter", () => {
		it("sends the provided device in the payload", async () => {
			const qc = createClient();
			qc.setQueryData(
				["dashboardWidget", "list", { device: "mobile" }],
				[widget({ id: "w1" })]
			);
			trpcMocks.updateLayouts.mockResolvedValue(undefined);
			const { result } = renderHook(() => useLayoutSync("mobile"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.enqueue([{ id: "w1", x: 1, y: 1, w: 1, h: 1 }]);
			});
			await act(async () => {
				await result.current.flush();
			});
			expect(trpcMocks.updateLayouts).toHaveBeenCalledWith(
				expect.objectContaining({ device: "mobile" })
			);
		});
	});
});
