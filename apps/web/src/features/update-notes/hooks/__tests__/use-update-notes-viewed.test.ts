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
	markViewed: vi.fn(),
}));

vi.mock("@/utils/trpc", () => {
	// Build a mutation-options object that mimics what TanStack Query expects.
	// useMutation calls mutationFn with the input; we shunt to the spy.
	const markViewedOptions = (opts: Record<string, unknown>) => ({
		mutationKey: ["updateNoteView", "markViewed"],
		mutationFn: (input: unknown) => trpcMocks.markViewed(input),
		...opts,
	});
	return {
		trpc: {
			updateNoteView: {
				list: {
					queryOptions: () => ({
						queryKey: buildKey("updateNoteView", "list", undefined),
						queryFn: () => Promise.resolve([]),
					}),
				},
				markViewed: {
					mutationOptions: markViewedOptions,
				},
				getLatestViewedVersion: {
					queryOptions: () => ({
						queryKey: buildKey(
							"updateNoteView",
							"getLatestViewedVersion",
							undefined
						),
						queryFn: () => Promise.resolve(null),
					}),
				},
			},
		},
	};
});

import { useUpdateNotesViewed } from "@/features/update-notes/hooks/use-update-notes-viewed";

const listKey = ["updateNoteView", "list"];
const latestKey = ["updateNoteView", "getLatestViewedVersion"];

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

describe("useUpdateNotesViewed", () => {
	beforeEach(() => {
		trpcMocks.markViewed.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("viewedVersions derivation", () => {
		it("is an empty set when server list is empty and nothing has been optimistically marked", () => {
			const qc = createClient();
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.viewedVersions).toBeInstanceOf(Set);
			expect(result.current.viewedVersions.size).toBe(0);
		});

		it("merges server-viewed versions from the cache into the set", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, [
				{ id: "1", version: "1.0.0" },
				{ id: "2", version: "1.1.0" },
			]);
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.viewedVersions.size).toBe(2));
			expect(result.current.viewedVersions.has("1.0.0")).toBe(true);
			expect(result.current.viewedVersions.has("1.1.0")).toBe(true);
		});
	});

	describe("handleAccordionChange", () => {
		it("marks an unviewed version optimistically and fires the mutation", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			trpcMocks.markViewed.mockResolvedValue({ id: "x" });
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange(["2.0.0"]);
			});
			await waitFor(() => {
				expect(result.current.viewedVersions.has("2.0.0")).toBe(true);
			});
			expect(trpcMocks.markViewed).toHaveBeenCalledWith({ version: "2.0.0" });
			expect(trpcMocks.markViewed).toHaveBeenCalledTimes(1);
		});

		it("skips mutation for versions already in the server viewed list", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, [{ id: "1", version: "1.0.0" }]);
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.viewedVersions.has("1.0.0")).toBe(true)
			);
			act(() => {
				result.current.handleAccordionChange(["1.0.0"]);
			});
			expect(trpcMocks.markViewed).not.toHaveBeenCalled();
		});

		it("skips mutation when called a second time with the same version (optimistic dedup)", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			trpcMocks.markViewed.mockResolvedValue({ id: "x" });
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange(["2.0.0"]);
			});
			await waitFor(() =>
				expect(result.current.viewedVersions.has("2.0.0")).toBe(true)
			);
			act(() => {
				result.current.handleAccordionChange(["2.0.0"]);
			});
			expect(trpcMocks.markViewed).toHaveBeenCalledTimes(1);
		});

		it("handles an empty accordion value (collapse-all) without calling mutation", () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange([]);
			});
			expect(trpcMocks.markViewed).not.toHaveBeenCalled();
		});

		it("marks multiple unviewed versions in a single call and fires N mutations", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			trpcMocks.markViewed.mockResolvedValue({ id: "x" });
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange(["1.0.0", "2.0.0", "3.0.0"]);
			});
			await waitFor(() => {
				expect(result.current.viewedVersions.has("1.0.0")).toBe(true);
				expect(result.current.viewedVersions.has("2.0.0")).toBe(true);
				expect(result.current.viewedVersions.has("3.0.0")).toBe(true);
			});
			expect(trpcMocks.markViewed).toHaveBeenCalledTimes(3);
			expect(trpcMocks.markViewed).toHaveBeenNthCalledWith(1, {
				version: "1.0.0",
			});
			expect(trpcMocks.markViewed).toHaveBeenNthCalledWith(2, {
				version: "2.0.0",
			});
			expect(trpcMocks.markViewed).toHaveBeenNthCalledWith(3, {
				version: "3.0.0",
			});
		});

		it("mixes viewed + unviewed: skips viewed, fires mutation for unviewed only", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, [{ id: "1", version: "1.0.0" }]);
			trpcMocks.markViewed.mockResolvedValue({ id: "x" });
			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.viewedVersions.has("1.0.0")).toBe(true)
			);
			act(() => {
				result.current.handleAccordionChange(["1.0.0", "2.0.0"]);
			});
			await waitFor(() =>
				expect(result.current.viewedVersions.has("2.0.0")).toBe(true)
			);
			expect(trpcMocks.markViewed).toHaveBeenCalledTimes(1);
			expect(trpcMocks.markViewed).toHaveBeenCalledWith({ version: "2.0.0" });
		});
	});

	describe("onSettled invalidation", () => {
		it("invalidates both list and getLatestViewedVersion queries after mutation settles", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			qc.setQueryData(latestKey, null);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.markViewed.mockResolvedValue({ id: "ok" });

			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange(["9.9.9"]);
			});
			await waitFor(() => {
				const calls = invalidateSpy.mock.calls.map(
					(c) => (c[0] as { queryKey: unknown[] } | undefined)?.queryKey
				);
				expect(calls).toEqual(expect.arrayContaining([listKey, latestKey]));
			});
		});

		it("also invalidates after a failed mutation (onSettled runs regardless)", async () => {
			const qc = createClient();
			qc.setQueryData(listKey, []);
			const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
			trpcMocks.markViewed.mockRejectedValue(new Error("server down"));

			const { result } = renderHook(() => useUpdateNotesViewed(), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleAccordionChange(["5.5.5"]);
			});
			await waitFor(() => {
				expect(trpcMocks.markViewed).toHaveBeenCalled();
			});
			await waitFor(() => {
				const calls = invalidateSpy.mock.calls.map(
					(c) => (c[0] as { queryKey: unknown[] } | undefined)?.queryKey
				);
				expect(calls).toEqual(expect.arrayContaining([listKey]));
			});
		});
	});
});
