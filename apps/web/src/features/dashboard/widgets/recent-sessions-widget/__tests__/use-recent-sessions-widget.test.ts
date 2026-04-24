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
				queryOptions: (input: { type?: string }) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
}));

import {
	parseRecentSessionsWidgetConfig,
	useRecentSessionsWidget,
} from "@/features/dashboard/widgets/recent-sessions-widget/use-recent-sessions-widget";

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

describe("parseRecentSessionsWidgetConfig", () => {
	it("defaults limit to 5 when not a valid number", () => {
		expect(parseRecentSessionsWidgetConfig({}).limit).toBe(5);
		expect(parseRecentSessionsWidgetConfig({ limit: 0 }).limit).toBe(5);
		expect(parseRecentSessionsWidgetConfig({ limit: -1 }).limit).toBe(5);
		expect(parseRecentSessionsWidgetConfig({ limit: 21 }).limit).toBe(5);
		expect(parseRecentSessionsWidgetConfig({ limit: "7" }).limit).toBe(5);
	});

	it("accepts limit in the 1..20 range, floored", () => {
		expect(parseRecentSessionsWidgetConfig({ limit: 1 }).limit).toBe(1);
		expect(parseRecentSessionsWidgetConfig({ limit: 20 }).limit).toBe(20);
		expect(parseRecentSessionsWidgetConfig({ limit: 7.9 }).limit).toBe(7);
	});

	it("preserves cash_game / tournament types, falls back otherwise", () => {
		expect(parseRecentSessionsWidgetConfig({ type: "cash_game" }).type).toBe(
			"cash_game"
		);
		expect(parseRecentSessionsWidgetConfig({ type: "tournament" }).type).toBe(
			"tournament"
		);
		expect(parseRecentSessionsWidgetConfig({ type: "other" }).type).toBe("all");
		expect(parseRecentSessionsWidgetConfig({}).type).toBe("all");
	});
});

describe("useRecentSessionsWidget", () => {
	it("slices items down to the configured limit", async () => {
		const qc = createClient();
		qc.setQueryData(["session", "list", { type: undefined }], {
			items: [
				{ id: "s1" },
				{ id: "s2" },
				{ id: "s3" },
				{ id: "s4" },
				{ id: "s5" },
				{ id: "s6" },
			],
		});
		const { result } = renderHook(() => useRecentSessionsWidget({ limit: 3 }), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.items).toHaveLength(3));
		expect(result.current.limit).toBe(3);
	});

	it("passes the type through to the query when filtering", async () => {
		const qc = createClient();
		qc.setQueryData(["session", "list", { type: "tournament" }], {
			items: [{ id: "t1" }],
		});
		const { result } = renderHook(
			() => useRecentSessionsWidget({ type: "tournament" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.items).toHaveLength(1));
	});

	it("returns empty items when the cache has no data", () => {
		const qc = createClient();
		const { result } = renderHook(() => useRecentSessionsWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.items).toEqual([]);
	});
});
