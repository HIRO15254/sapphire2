import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	create: vi.fn(),
	update: vi.fn(),
	del: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionTag: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("sessionTag", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
	trpcClient: {
		sessionTag: {
			create: { mutate: trpcMocks.create },
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.del },
		},
	},
}));

import { useSessionTags } from "@/features/sessions/components/session-tag-manager/use-session-tags";

const TAG_LIST_KEY = ["sessionTag", "list"];

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

describe("useSessionTags", () => {
	beforeEach(() => {
		trpcMocks.create.mockReset();
		trpcMocks.update.mockReset();
		trpcMocks.del.mockReset();
	});

	it("exposes the seeded list", () => {
		const qc = createClient();
		qc.setQueryData(TAG_LIST_KEY, [
			{ id: "t1", name: "Tournament" },
			{ id: "t2", name: "Home Game" },
		]);
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.tags).toHaveLength(2);
	});

	it("returns empty array when cache is empty", () => {
		const qc = createClient();
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.tags).toEqual([]);
	});

	it("create forwards the name", async () => {
		const qc = createClient();
		qc.setQueryData(TAG_LIST_KEY, []);
		trpcMocks.create.mockResolvedValue({ id: "new", name: "x" });
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		await act(async () => {
			await result.current.create("x");
		});
		expect(trpcMocks.create).toHaveBeenCalledWith({ name: "x" });
	});

	it("update optimistically patches the name of the matching tag", async () => {
		const qc = createClient();
		qc.setQueryData(TAG_LIST_KEY, [
			{ id: "t1", name: "Old" },
			{ id: "t2", name: "Other" },
		]);
		let resolveUpdate: ((v: unknown) => void) | undefined;
		trpcMocks.update.mockImplementation(
			() =>
				new Promise((r) => {
					resolveUpdate = r;
				})
		);
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.update({ id: "t1", name: "New" });
		});
		await waitFor(() => {
			const list =
				qc.getQueryData<Array<{ id: string; name: string }>>(TAG_LIST_KEY);
			expect(list?.find((t) => t.id === "t1")?.name).toBe("New");
		});
		resolveUpdate?.({ id: "t1", name: "New" });
	});

	it("delete optimistically removes the tag", async () => {
		const qc = createClient();
		qc.setQueryData(TAG_LIST_KEY, [
			{ id: "t1", name: "A" },
			{ id: "t2", name: "B" },
		]);
		let resolveDelete: ((v: unknown) => void) | undefined;
		trpcMocks.del.mockImplementation(
			() =>
				new Promise((r) => {
					resolveDelete = r;
				})
		);
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.delete("t1");
		});
		await waitFor(() => {
			const list = qc.getQueryData<Array<{ id: string }>>(TAG_LIST_KEY);
			expect(list?.some((t) => t.id === "t1")).toBe(false);
			expect(list?.some((t) => t.id === "t2")).toBe(true);
		});
		resolveDelete?.({ id: "t1" });
	});

	it("isCreatePending / isUpdatePending / isDeletePending reflect mutation state", async () => {
		const qc = createClient();
		qc.setQueryData(TAG_LIST_KEY, [{ id: "t1", name: "x" }]);
		let resolveCreate: ((v: unknown) => void) | undefined;
		trpcMocks.create.mockImplementation(
			() =>
				new Promise((r) => {
					resolveCreate = r;
				})
		);
		const { result } = renderHook(() => useSessionTags(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.isCreatePending).toBe(false);
		expect(result.current.isUpdatePending).toBe(false);
		expect(result.current.isDeletePending).toBe(false);
		act(() => {
			result.current.create("Bonus");
		});
		await waitFor(() => expect(result.current.isCreatePending).toBe(true));
		resolveCreate?.({ id: "new" });
		await waitFor(() => expect(result.current.isCreatePending).toBe(false));
	});
});
