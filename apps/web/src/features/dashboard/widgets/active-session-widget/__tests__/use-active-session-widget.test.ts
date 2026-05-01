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
	DEFAULT_GLOBAL_FILTER_VALUES,
	GlobalFilterProvider,
	type GlobalFilterValues,
} from "@/features/dashboard/hooks/use-global-filter";
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

function wrapperWithGlobalFilter(
	client: QueryClient,
	values: GlobalFilterValues
) {
	const setValue = vi.fn();
	const reset = vi.fn();
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client },
			createElement(
				GlobalFilterProvider,
				{ value: { values, setValue, reset } },
				children
			)
		);
	};
}

describe("parseActiveSessionWidgetConfig", () => {
	it("defaults type to 'all' when raw has no value", () => {
		expect(parseActiveSessionWidgetConfig({})).toEqual({ type: "all" });
	});

	it("keeps cash_game and tournament values from `type`", () => {
		expect(parseActiveSessionWidgetConfig({ type: "cash_game" }).type).toBe(
			"cash_game"
		);
		expect(parseActiveSessionWidgetConfig({ type: "tournament" }).type).toBe(
			"tournament"
		);
	});

	it("reads legacy `sessionType` key when `type` is missing", () => {
		expect(
			parseActiveSessionWidgetConfig({ sessionType: "cash_game" }).type
		).toBe("cash_game");
		expect(
			parseActiveSessionWidgetConfig({ sessionType: "tournament" }).type
		).toBe("tournament");
	});

	it("prefers `type` over legacy `sessionType`", () => {
		expect(
			parseActiveSessionWidgetConfig({
				type: "cash_game",
				sessionType: "tournament",
			}).type
		).toBe("cash_game");
	});

	it("coerces unknown type to 'all'", () => {
		expect(parseActiveSessionWidgetConfig({ type: "weird" }).type).toBe("all");
		expect(parseActiveSessionWidgetConfig({ sessionType: "weird" }).type).toBe(
			"all"
		);
	});
});

describe("useActiveSessionWidget", () => {
	it("returns both cash and tournament items for type 'all'", async () => {
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

	it("returns only cash items when type is 'cash_game'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ type: "cash_game" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.cashItems).toHaveLength(1));
		expect(result.current.tournamentItems).toEqual([]);
	});

	it("returns only tournament items when type is 'tournament'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ type: "tournament" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.tournamentItems).toHaveLength(1));
		expect(result.current.cashItems).toEqual([]);
	});

	it("honors legacy `sessionType` config when filtering", async () => {
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

	it("returns empty arrays when queries have no data", () => {
		const qc = createClient();
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.cashItems).toEqual([]);
		expect(result.current.tournamentItems).toEqual([]);
	});
});

describe("useActiveSessionWidget — global filter integration", () => {
	it("global filter type='cash_game' overrides local 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(() => useActiveSessionWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				type: "cash_game",
			}),
		});
		await waitFor(() => expect(result.current.cashItems).toHaveLength(1));
		expect(result.current.tournamentItems).toEqual([]);
	});

	it("global filter type='tournament' overrides local 'cash_game'", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ type: "cash_game" }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					...DEFAULT_GLOBAL_FILTER_VALUES,
					type: "tournament",
				}),
			}
		);
		await waitFor(() => expect(result.current.tournamentItems).toHaveLength(1));
		expect(result.current.cashItems).toEqual([]);
	});

	it("falls back to local when global type is null (no override)", async () => {
		const qc = createClient();
		qc.setQueryData(CASH_KEY, { items: [{ id: "c1" }] });
		qc.setQueryData(TOURNAMENT_KEY, { items: [{ id: "t1" }] });
		const { result } = renderHook(
			() => useActiveSessionWidget({ type: "tournament" }),
			{
				wrapper: wrapperWithGlobalFilter(qc, DEFAULT_GLOBAL_FILTER_VALUES),
			}
		);
		await waitFor(() => expect(result.current.tournamentItems).toHaveLength(1));
		expect(result.current.cashItems).toEqual([]);
	});
});
