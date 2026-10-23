import type { AppRouter } from "@sapphire2/api/routers/index";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createTRPCClient } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "@/__tests__/test-utils";
import { useUpdateNotesViewed } from "@/features/update-notes/hooks/use-update-notes-viewed";

const transport = vi.hoisted(() => ({
	queryClient: undefined as QueryClient | undefined,
	list: vi.fn<() => Promise<{ id: string; version: string }[]>>(),
	markViewed: vi.fn<(input: unknown) => Promise<unknown>>(),
}));

vi.mock("@/utils/trpc", () => ({
	get trpc() {
		return trpc;
	},
}));

const trpc = createTRPCOptionsProxy<AppRouter>({
	client: createTRPCClient<AppRouter>({
		links: [
			() =>
				({ op }) =>
					observable((observer) => {
						let response: Promise<unknown>;
						switch (op.path) {
							case "updateNoteView.list":
								response = transport.list();
								break;
							case "updateNoteView.markViewed":
								response = transport.markViewed(op.input);
								break;
							default:
								throw new Error(`Unexpected procedure: ${op.path}`);
						}
						response.then(
							(data) => {
								observer.next({ result: { data } });
								observer.complete();
							},
							(error) => observer.error(error)
						);
					}),
		],
	}),
	queryClient: () => {
		if (!transport.queryClient) {
			throw new Error("QueryClient not initialized");
		}
		return transport.queryClient;
	},
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function mountHook() {
	const client = transport.queryClient;
	if (!client) {
		throw new Error("QueryClient not initialized");
	}
	return renderHook(() => useUpdateNotesViewed(), {
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client }, children),
	});
}

describe("useUpdateNotesViewed", () => {
	beforeEach(() => {
		transport.queryClient = createTestQueryClient();
		transport.list.mockReset().mockResolvedValue([]);
		transport.markViewed.mockReset().mockResolvedValue({ id: "new" });
	});

	it("keeps server and optimistic versions visible while a new mark is pending", async () => {
		const pending = deferred<unknown>();
		transport.markViewed.mockReturnValue(pending.promise);
		transport.queryClient?.setQueryData(trpc.updateNoteView.list.queryKey(), [
			{ id: "old", userId: "user", version: "1.0.0", viewedAt: "2026-01-01" },
		]);
		const { result } = mountHook();

		act(() => result.current.markViewed("2.0.0"));

		expect(result.current.viewedVersions).toEqual(new Set(["1.0.0", "2.0.0"]));
		await waitFor(() => {
			expect(transport.markViewed).toHaveBeenCalledExactlyOnceWith({
				version: "2.0.0",
			});
		});
		await act(async () => pending.resolve({ id: "new" }));
	});

	it("does not save versions the server already marked as viewed", async () => {
		transport.queryClient?.setQueryData(trpc.updateNoteView.list.queryKey(), [
			{ id: "old", userId: "user", version: "1.0.0", viewedAt: "2026-01-01" },
		]);
		const { result } = mountHook();

		await act(async () => result.current.markViewed("1.0.0"));

		expect(transport.markViewed).not.toHaveBeenCalled();
	});

	it("does not save an optimistic version twice when it is reopened", async () => {
		const pending = deferred<unknown>();
		transport.markViewed.mockReturnValue(pending.promise);
		const { result } = mountHook();
		await waitFor(() => expect(result.current.isViewedListLoaded).toBe(true));

		act(() => result.current.markViewed("2.0.0"));
		await waitFor(() => expect(transport.markViewed).toHaveBeenCalledTimes(1));
		await act(async () => result.current.markViewed("2.0.0"));

		expect(transport.markViewed).toHaveBeenCalledTimes(1);
		await act(async () => pending.resolve({ id: "new" }));
	});

	it("waits for the server before treating even an empty viewed list as loaded", async () => {
		const pending = deferred<{ id: string; version: string }[]>();
		transport.list.mockReturnValue(pending.promise);
		const { result } = mountHook();

		expect(result.current.isViewedListLoaded).toBe(false);
		await act(async () => pending.resolve([]));

		await waitFor(() => expect(result.current.isViewedListLoaded).toBe(true));
		expect(result.current.viewedVersions).toEqual(new Set());
	});

	it.each([
		"success",
		"failure",
	] as const)("refetches the mounted list after mutation %s so viewed badges resync", async (outcome) => {
		const pending = deferred<unknown>();
		transport.markViewed.mockReturnValue(pending.promise);
		const { result } = mountHook();
		await waitFor(() => expect(result.current.isViewedListLoaded).toBe(true));
		expect(transport.list).toHaveBeenCalledTimes(1);

		act(() => result.current.markViewed("2.0.0"));
		await waitFor(() => expect(transport.markViewed).toHaveBeenCalledTimes(1));
		expect(transport.list).toHaveBeenCalledTimes(1);
		act(() => {
			if (outcome === "success") {
				pending.resolve({ id: "new" });
			} else {
				pending.reject(new Error("server down"));
			}
		});

		await waitFor(() => expect(transport.list).toHaveBeenCalledTimes(2));
	});
});
