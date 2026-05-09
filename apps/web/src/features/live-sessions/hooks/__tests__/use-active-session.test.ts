import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
	trpcClient: {},
}));

import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

const sessionListKey = ["session", "list", {}];

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

function seedEmpty(client: QueryClient) {
	client.setQueryData(sessionListKey, { items: [] });
}

describe("useActiveSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null with hasActive=false when list is empty", () => {
		const qc = createClient();
		seedEmpty(qc);
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
		expect(result.current.isLoading).toBe(false);
	});

	it("flags isLoading=true while the query is loading (no seed)", async () => {
		const qc = createClient();
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("returns an active cash session from session list", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "cash-1", source: "live", kind: "cash_game", status: "active" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "cash-1",
			kind: "cash_game",
			status: "active",
		});
		expect(result.current.hasActive).toBe(true);
	});

	it("returns a paused cash session", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "cash-p1", source: "live", kind: "cash_game", status: "paused" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "cash-p1",
			kind: "cash_game",
			status: "paused",
		});
	});

	it("prefers active over paused when both exist", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "cash-active", source: "live", kind: "cash_game", status: "active" },
				{ id: "cash-paused", source: "live", kind: "cash_game", status: "paused" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession?.id).toBe("cash-active");
		expect(result.current.activeSession?.status).toBe("active");
	});

	it("returns an active tournament session", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "t-1", source: "live", kind: "tournament", status: "active" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "t-1",
			kind: "tournament",
			status: "active",
		});
	});

	it("returns a paused tournament session", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "t-p1", source: "live", kind: "tournament", status: "paused" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "t-p1",
			kind: "tournament",
			status: "paused",
		});
	});

	it("uses kind field (not type) for cash_game sessions", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "cash-1", source: "live", kind: "cash_game", status: "active" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession?.kind).toBe("cash_game");
	});

	it("ignores manual sessions (source !== live)", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "manual-1", source: "manual", kind: "cash_game", status: "active" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
	});

	it("ignores completed sessions even from live source", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "completed-1", source: "live", kind: "cash_game", status: "completed" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
	});

	it("returns null when items array is empty", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, { items: [] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
	});

	it("handles missing items property gracefully", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
	});

	it("picks first active live session when multiple live sessions are present", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey, {
			items: [
				{ id: "t-1", source: "live", kind: "tournament", status: "active" },
				{ id: "cash-1", source: "live", kind: "cash_game", status: "active" },
			],
		});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		// first active live item wins
		expect(result.current.activeSession?.id).toBe("t-1");
	});
});
