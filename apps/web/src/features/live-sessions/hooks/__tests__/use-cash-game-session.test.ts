import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const navigateMock = vi.hoisted(() => vi.fn());
const trpcMocks = vi.hoisted(() => ({
	discard: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
					queryFn: () => Promise.resolve(null),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		ringGame: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByStore", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			discard: { mutate: trpcMocks.discard },
		},
	},
}));

import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";

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

describe("useCashGameSession", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns undefined session, empty ringGames, and is idle when sessionId is empty (query disabled)", () => {
		const qc = createClient();
		const { result } = renderHook(() => useCashGameSession(""), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.session).toBeUndefined();
		expect(result.current.ringGames).toEqual([]);
		expect(result.current.isDiscardPending).toBe(false);
	});

	it("exposes session from cache and ringGames scoped by storeId", async () => {
		const qc = createClient();
		qc.setQueryData(["liveCashGameSession", "getById", { id: "s1" }], {
			id: "s1",
			storeId: "store-1",
		});
		qc.setQueryData(
			["ringGame", "listByStore", { storeId: "store-1" }],
			[{ id: "rg1", name: "NL200" }]
		);
		const { result } = renderHook(() => useCashGameSession("s1"), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.session).toEqual({ id: "s1", storeId: "store-1" });
		});
		expect(result.current.ringGames).toHaveLength(1);
	});

	it("does not load ringGames when session.storeId is absent (enabled gate)", async () => {
		const qc = createClient();
		qc.setQueryData(["liveCashGameSession", "getById", { id: "s1" }], {
			id: "s1",
		});
		const { result } = renderHook(() => useCashGameSession("s1"), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.session).toBeDefined();
		});
		expect(result.current.ringGames).toEqual([]);
	});

	it("discard() mutates via trpcClient, navigates to /sessions on success", async () => {
		const qc = createClient();
		trpcMocks.discard.mockResolvedValue({ id: "s1" });
		const { result } = renderHook(() => useCashGameSession("s1"), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			result.current.discard();
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(trpcMocks.discard).toHaveBeenCalledWith({ id: "s1" });
		});
		await waitFor(() => {
			expect(navigateMock).toHaveBeenCalledWith({ to: "/sessions" });
		});
	});

	it("flips isDiscardPending while the discard mutation is in flight", async () => {
		const qc = createClient();
		let resolve: ((v: unknown) => void) | undefined;
		trpcMocks.discard.mockImplementation(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const { result } = renderHook(() => useCashGameSession("s1"), {
			wrapper: makeWrapper(qc),
		});
		act(() => {
			result.current.discard();
		});
		await waitFor(() => expect(result.current.isDiscardPending).toBe(true));
		resolve?.({ id: "s1" });
		await waitFor(() => expect(result.current.isDiscardPending).toBe(false));
	});

	it("does not navigate when discard fails", async () => {
		const qc = createClient();
		trpcMocks.discard.mockRejectedValue(new Error("boom"));
		const { result } = renderHook(() => useCashGameSession("s1"), {
			wrapper: makeWrapper(qc),
		});
		await act(async () => {
			result.current.discard();
			await Promise.resolve();
		});
		await waitFor(() => {
			expect(trpcMocks.discard).toHaveBeenCalled();
		});
		// Give a microtask flush so navigateMock would fire if it were going to.
		await Promise.resolve();
		expect(navigateMock).not.toHaveBeenCalled();
	});
});
