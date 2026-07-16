import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionFormValues } from "@/features/sessions/hooks/use-sessions";

const trpcMocks = vi.hoisted(() => ({
	getByIdQueryFn: vi.fn(),
	tagListQueryFn: vi.fn(),
	sessionUpdate: vi.fn(),
	sessionDelete: vi.fn(),
	sessionTagCreate: vi.fn(),
	reopen: vi.fn(),
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => trpcMocks.navigate,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: ["session", "getById", input],
					queryFn: () => trpcMocks.getByIdQueryFn(),
				}),
			},
			list: {
				queryKey: () => ["session", "list"],
			},
		},
		sessionTag: {
			list: {
				queryOptions: () => ({
					queryKey: ["sessionTag", "list"],
					queryFn: () => trpcMocks.tagListQueryFn(),
				}),
			},
		},
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: ["liveCashGameSession", "list", input],
				}),
			},
		},
	},
	trpcClient: {
		session: {
			update: { mutate: trpcMocks.sessionUpdate },
			delete: { mutate: trpcMocks.sessionDelete },
		},
		sessionTag: {
			create: { mutate: trpcMocks.sessionTagCreate },
		},
		liveCashGameSession: {
			reopen: { mutate: trpcMocks.reopen },
		},
	},
}));

import { useSessionDetail } from "@/features/sessions/hooks/use-session-detail";

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

const cashValues: SessionFormValues = {
	type: "cash_game",
	sessionDate: "2026-01-15",
	buyIn: 100,
	cashOut: 250,
	memo: "gg",
	tagIds: ["t1"],
	roomId: "r1",
	currencyId: "c1",
} as SessionFormValues;

describe("useSessionDetail", () => {
	beforeEach(() => {
		trpcMocks.getByIdQueryFn
			.mockReset()
			.mockResolvedValue({ id: "s1", type: "cash_game", source: "manual" });
		trpcMocks.tagListQueryFn
			.mockReset()
			.mockResolvedValue([{ id: "t1", name: "Live" }]);
		trpcMocks.sessionUpdate.mockReset().mockResolvedValue(undefined);
		trpcMocks.sessionDelete.mockReset().mockResolvedValue(undefined);
		trpcMocks.sessionTagCreate
			.mockReset()
			.mockResolvedValue({ id: "t2", name: "New" });
		trpcMocks.reopen.mockReset().mockResolvedValue(undefined);
		trpcMocks.navigate.mockReset().mockResolvedValue(undefined);
	});

	it("loads the session from getById", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		await waitFor(() => expect(result.current.session).not.toBeNull());
		expect(result.current.session).toEqual({
			id: "s1",
			type: "cash_game",
			source: "manual",
		});
	});

	it("exposes the available tags from sessionTag.list", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		await waitFor(() =>
			expect(result.current.availableTags).toEqual([{ id: "t1", name: "Live" }])
		);
	});

	it("reports isLoading until the session resolves", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("exposes an initial query failure and clears it after retry", async () => {
		trpcMocks.getByIdQueryFn
			.mockRejectedValueOnce(new Error("network failure"))
			.mockResolvedValue({ id: "s1", type: "cash_game", source: "manual" });
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});

		await waitFor(() => expect(result.current.isInitialLoadError).toBe(true));
		expect(result.current.session).toBeNull();

		await act(async () => {
			await result.current.onRetry();
		});

		await waitFor(() => expect(result.current.isInitialLoadError).toBe(false));
		expect(result.current.session).toMatchObject({ id: "s1" });
		expect(trpcMocks.getByIdQueryFn).toHaveBeenCalledTimes(2);
	});

	it("keeps a cached session usable after a refetch failure", async () => {
		const qc = createClient();
		qc.setQueryData(["session", "getById", { id: "s1" }], {
			id: "s1",
			type: "cash_game",
			source: "manual",
		});
		trpcMocks.getByIdQueryFn.mockRejectedValueOnce(
			new Error("network failure")
		);
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(qc),
		});

		expect(result.current.session).toMatchObject({ id: "s1" });

		await act(async () => {
			await result.current.onRetry();
		});

		await waitFor(() =>
			expect(trpcMocks.getByIdQueryFn).toHaveBeenCalledTimes(1)
		);
		expect(result.current.isInitialLoadError).toBe(false);
		expect(result.current.session).toMatchObject({ id: "s1" });
	});

	it("sends the full update payload for a manual session", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		await act(async () => {
			await result.current.update({
				id: "s1",
				isLiveLinked: false,
				...cashValues,
			});
		});
		expect(trpcMocks.sessionUpdate).toHaveBeenCalledTimes(1);
		expect(trpcMocks.sessionUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "s1",
				buyIn: 100,
				cashOut: 250,
				memo: "gg",
			})
		);
	});

	it("sends the trimmed live-linked payload for a live session", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		await act(async () => {
			await result.current.update({
				id: "s1",
				isLiveLinked: true,
				...cashValues,
			});
		});
		const payload = trpcMocks.sessionUpdate.mock.calls[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(payload).toEqual({
			id: "s1",
			memo: "gg",
			tagIds: ["t1"],
			roomId: "r1",
			currencyId: "c1",
		});
		expect(payload).not.toHaveProperty("buyIn");
	});

	it("invalidates the detail and list queries after an update", async () => {
		const client = createClient();
		const spy = vi.spyOn(client, "invalidateQueries");
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(client),
		});
		await act(async () => {
			await result.current.update({
				id: "s1",
				isLiveLinked: false,
				...cashValues,
			});
		});
		await waitFor(() =>
			expect(spy).toHaveBeenCalledWith({ queryKey: ["session", "list"] })
		);
		expect(spy).toHaveBeenCalledWith({
			queryKey: ["session", "getById", { id: "s1" }],
		});
	});

	it("deletes the session and invalidates the list", async () => {
		const client = createClient();
		const spy = vi.spyOn(client, "invalidateQueries");
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(client),
		});
		act(() => {
			result.current.deleteSession("s1");
		});
		await waitFor(() =>
			expect(trpcMocks.sessionDelete).toHaveBeenCalledWith({ id: "s1" })
		);
		await waitFor(() =>
			expect(spy).toHaveBeenCalledWith({ queryKey: ["session", "list"] })
		);
	});

	it("reopens a live cash game and navigates to the active session", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		act(() => {
			result.current.reopen("s1");
		});
		await waitFor(() =>
			expect(trpcMocks.reopen).toHaveBeenCalledWith({ id: "s1" })
		);
		await waitFor(() =>
			expect(trpcMocks.navigate).toHaveBeenCalledWith({ to: "/active-session" })
		);
	});

	it("creates a tag and returns the id + name", async () => {
		const { result } = renderHook(() => useSessionDetail("s1"), {
			wrapper: makeWrapper(createClient()),
		});
		let created: { id: string; name: string } | undefined;
		await act(async () => {
			created = await result.current.createTag("New");
		});
		expect(trpcMocks.sessionTagCreate).toHaveBeenCalledWith({ name: "New" });
		expect(created).toEqual({ id: "t2", name: "New" });
	});
});
