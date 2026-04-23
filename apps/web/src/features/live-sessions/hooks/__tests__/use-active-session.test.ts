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
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		liveTournamentSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
	trpcClient: {},
}));

import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";

const cashActiveKey = [
	"liveCashGameSession",
	"list",
	{ status: "active", limit: 1 },
];
const cashPausedKey = [
	"liveCashGameSession",
	"list",
	{ status: "paused", limit: 1 },
];
const tourActiveKey = [
	"liveTournamentSession",
	"list",
	{ status: "active", limit: 1 },
];
const tourPausedKey = [
	"liveTournamentSession",
	"list",
	{ status: "paused", limit: 1 },
];

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

function seedAllEmpty(client: QueryClient) {
	client.setQueryData(cashActiveKey, { items: [] });
	client.setQueryData(cashPausedKey, { items: [] });
	client.setQueryData(tourActiveKey, { items: [] });
	client.setQueryData(tourPausedKey, { items: [] });
}

describe("useActiveSession", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null with hasActive=false when no queries have data yet", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
		expect(result.current.isLoading).toBe(false);
	});

	it("flags isLoading=true while any of the four queries is loading", async () => {
		const qc = createClient();
		// Seed 3 to empty; leave cashPaused as loading (no seed → it fetches).
		qc.setQueryData(cashActiveKey, { items: [] });
		qc.setQueryData(tourActiveKey, { items: [] });
		qc.setQueryData(tourPausedKey, { items: [] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isLoading).toBe(true);
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("returns an active cash session when cashActive has an item", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(cashActiveKey, { items: [{ id: "cash-1" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "cash-1",
			type: "cash_game",
			status: "active",
		});
		expect(result.current.hasActive).toBe(true);
	});

	it("returns a paused cash session when only cashPaused has items", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(cashPausedKey, { items: [{ id: "cash-p1" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "cash-p1",
			type: "cash_game",
			status: "paused",
		});
	});

	it("prefers the active cash session over the paused cash session when both have items", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(cashActiveKey, { items: [{ id: "cash-active" }] });
		qc.setQueryData(cashPausedKey, { items: [{ id: "cash-paused" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession?.id).toBe("cash-active");
		expect(result.current.activeSession?.status).toBe("active");
	});

	it("returns an active tournament when only tournament queries have items", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(tourActiveKey, { items: [{ id: "t-1" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "t-1",
			type: "tournament",
			status: "active",
		});
	});

	it("returns a paused tournament when only tournamentPaused has items", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(tourPausedKey, { items: [{ id: "t-p1" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toEqual({
			id: "t-p1",
			type: "tournament",
			status: "paused",
		});
	});

	it("prefers a cash session over a tournament when both are active (cash wins the if/else)", () => {
		const qc = createClient();
		seedAllEmpty(qc);
		qc.setQueryData(cashActiveKey, { items: [{ id: "cash-1" }] });
		qc.setQueryData(tourActiveKey, { items: [{ id: "t-1" }] });
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession?.type).toBe("cash_game");
	});

	it("handles queries whose data shape is missing items array (optional chaining branch)", () => {
		const qc = createClient();
		qc.setQueryData(cashActiveKey, {});
		qc.setQueryData(cashPausedKey, {});
		qc.setQueryData(tourActiveKey, {});
		qc.setQueryData(tourPausedKey, {});
		const { result } = renderHook(() => useActiveSession(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.activeSession).toBeNull();
		expect(result.current.hasActive).toBe(false);
	});
});
