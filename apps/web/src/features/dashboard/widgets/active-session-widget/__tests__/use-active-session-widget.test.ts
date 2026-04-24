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
		liveCashGameSession: {
			list: {
				queryOptions: (input: { status: string; limit: number }) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		liveTournamentSession: {
			list: {
				queryOptions: (input: { status: string; limit: number }) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
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

const CASH_KEY = [
	"liveCashGameSession",
	"list",
	{ status: "active", limit: 5 },
];
const TOURNAMENT_KEY = [
	"liveTournamentSession",
	"list",
	{ status: "active", limit: 5 },
];

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
	it("returns both cash and tournament items for sessionType 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.cashItems).toHaveLength(1);
			expect(result.current.tournamentItems).toHaveLength(1);
		});
	});

	it("returns only cash items when sessionType is 'cash_game'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ sessionType: "cash_game" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.cashItems).toHaveLength(1));
		expect(result.current.tournamentItems).toEqual([]);
	});

	it("returns only tournament items when sessionType is 'tournament'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ sessionType: "tournament" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.tournamentItems).toHaveLength(1));
		expect(result.current.cashItems).toEqual([]);
	});

	it("returns empty arrays when queries have no data", () => {
		const qc = createClient();
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.cashItems).toEqual([]);
		expect(result.current.tournamentItems).toEqual([]);
	});
});
