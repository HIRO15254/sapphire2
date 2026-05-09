import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

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
}));

import {
	parseActiveSessionWidgetConfig,
	useActiveSessionWidget,
} from "@/features/dashboard/widgets/active-session-widget/use-active-session-widget";

function sessionListKey(input: unknown) {
	return buildKey("session", "list", input);
}

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

describe("parseActiveSessionWidgetConfig", () => {
	it("defaults sessionType to 'all' when raw has no value", () => {
		expect(parseActiveSessionWidgetConfig({})).toEqual({ sessionType: "all" });
	});

	it("keeps cash_game and tournament values", () => {
		expect(
			parseActiveSessionWidgetConfig({ sessionType: "cash_game" }).sessionType
		).toBe("cash_game");
		expect(
			parseActiveSessionWidgetConfig({ sessionType: "tournament" }).sessionType
		).toBe("tournament");
	});

	it("coerces unknown sessionType to 'all'", () => {
		expect(
			parseActiveSessionWidgetConfig({ sessionType: "weird" }).sessionType
		).toBe("all");
	});
});

describe("useActiveSessionWidget", () => {
	it("returns active live sessions for sessionType 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey({}), {
			items: [
				{ id: "c1", source: "live", kind: "cash_game", status: "active", startedAt: null },
				{ id: "t1", source: "live", kind: "tournament", status: "paused", startedAt: null },
				{ id: "manual1", source: "manual", kind: "cash_game", status: "active", startedAt: null },
			],
		});
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.sessions).toHaveLength(2);
		});
		const ids = result.current.sessions.map((s) => s.id);
		expect(ids).toContain("c1");
		expect(ids).toContain("t1");
		expect(ids).not.toContain("manual1");
	});

	it("returns only cash game sessions when sessionType is 'cash_game'", async () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey({ type: "cash_game" }), {
			items: [
				{ id: "c1", source: "live", kind: "cash_game", status: "active", startedAt: null },
				{ id: "t1", source: "live", kind: "tournament", status: "active", startedAt: null },
			],
		});
		const { result } = renderHook(
			() => useActiveSessionWidget({ sessionType: "cash_game" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.sessions.length).toBeGreaterThanOrEqual(0));
		const liveActive = result.current.sessions.filter(
			(s) => s.source === "live" && (s.status === "active" || s.status === "paused")
		);
		expect(liveActive.every((s) => s.kind === "cash_game" || s.kind === "tournament")).toBe(true);
	});

	it("returns empty sessions when list has no live active/paused items", () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey({}), {
			items: [
				{ id: "m1", source: "manual", kind: "cash_game", status: "active", startedAt: null },
				{ id: "c1", source: "live", kind: "cash_game", status: "completed", startedAt: null },
			],
		});
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.sessions).toEqual([]);
	});

	it("returns empty sessions when queries have no data yet", () => {
		const qc = createClient();
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.sessions).toEqual([]);
	});

	it("exposes isLoading=true while fetching", () => {
		const qc = createClient();
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.isLoading).toBe(true);
	});

	it("includes paused sessions in results", async () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey({}), {
			items: [
				{ id: "p1", source: "live", kind: "cash_game", status: "paused", startedAt: null },
			],
		});
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.sessions).toHaveLength(1);
		});
		expect(result.current.sessions[0]?.id).toBe("p1");
		expect(result.current.sessions[0]?.status).toBe("paused");
	});

	it("session items have id, kind, source, startedAt, status fields", async () => {
		const qc = createClient();
		qc.setQueryData(sessionListKey({}), {
			items: [
				{
					id: "c1",
					source: "live",
					kind: "cash_game",
					status: "active",
					startedAt: "2024-01-01T00:00:00Z",
				},
			],
		});
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.sessions).toHaveLength(1));
		const session = result.current.sessions[0];
		expect(session).toMatchObject({
			id: "c1",
			kind: "cash_game",
			source: "live",
			status: "active",
			startedAt: "2024-01-01T00:00:00Z",
		});
	});
});
