import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

interface CapturedInput {
	currencyId?: string;
	dateFrom?: number;
	ringGameId?: string;
	storeId?: string;
	type?: string;
}

const captured: { lastInput: CapturedInput | null } = { lastInput: null };

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			profitLossSeries: {
				queryOptions: (input: CapturedInput) => {
					captured.lastInput = input;
					return {
						queryKey: ["session", "profitLossSeries", input],
						queryFn: () => Promise.resolve({ points: [] }),
					};
				},
			},
		},
	},
}));

import {
	parsePnlGraphWidgetConfig,
	usePnlGraphWidget,
} from "@/features/dashboard/widgets/pnl-graph-widget/use-pnl-graph-widget";

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

describe("parsePnlGraphWidgetConfig", () => {
	it("returns defaults for an empty config", () => {
		const parsed = parsePnlGraphWidgetConfig({});
		expect(parsed.xAxis).toBe("date");
		expect(parsed.dateRangeDays).toBeNull();
		expect(parsed.sessionType).toBe("all");
		expect(parsed.unit).toBe("currency");
		expect(parsed.storeId).toBeNull();
		expect(parsed.ringGameId).toBeNull();
		expect(parsed.currencyId).toBeNull();
		expect(parsed.showFilters).toEqual({
			xAxis: false,
			dateRange: false,
			sessionType: false,
			unit: false,
			store: false,
			currency: false,
		});
	});

	it("coerces unknown enum values back to defaults", () => {
		const parsed = parsePnlGraphWidgetConfig({
			xAxis: "weird",
			sessionType: "rotation",
			unit: "satoshi",
		});
		expect(parsed.xAxis).toBe("date");
		expect(parsed.sessionType).toBe("all");
		expect(parsed.unit).toBe("currency");
	});

	it("keeps valid enum values", () => {
		const parsed = parsePnlGraphWidgetConfig({
			xAxis: "playTime",
			sessionType: "cash_game",
			unit: "normalized",
		});
		expect(parsed.xAxis).toBe("playTime");
		expect(parsed.sessionType).toBe("cash_game");
		expect(parsed.unit).toBe("normalized");
	});

	it("rejects legacy 'bb' / 'bi' unit values", () => {
		expect(parsePnlGraphWidgetConfig({ unit: "bb" }).unit).toBe("currency");
		expect(parsePnlGraphWidgetConfig({ unit: "bi" }).unit).toBe("currency");
	});

	it("treats non-positive or non-numeric dateRangeDays as null", () => {
		expect(
			parsePnlGraphWidgetConfig({ dateRangeDays: 0 }).dateRangeDays
		).toBeNull();
		expect(
			parsePnlGraphWidgetConfig({ dateRangeDays: -3 }).dateRangeDays
		).toBeNull();
		expect(
			parsePnlGraphWidgetConfig({ dateRangeDays: "7" }).dateRangeDays
		).toBeNull();
		expect(parsePnlGraphWidgetConfig({ dateRangeDays: 7 }).dateRangeDays).toBe(
			7
		);
	});

	it("preserves string ids and treats empty string as null", () => {
		expect(parsePnlGraphWidgetConfig({ storeId: "s1" }).storeId).toBe("s1");
		expect(parsePnlGraphWidgetConfig({ storeId: "" }).storeId).toBeNull();
		expect(parsePnlGraphWidgetConfig({ storeId: 5 }).storeId).toBeNull();
	});

	it("parses showFilters flags strictly via boolean equality", () => {
		const parsed = parsePnlGraphWidgetConfig({
			showFilters: {
				xAxis: true,
				dateRange: "yes",
				sessionType: 1,
				unit: false,
				store: null,
				currency: true,
			},
		});
		expect(parsed.showFilters).toEqual({
			xAxis: true,
			dateRange: false,
			sessionType: false,
			unit: false,
			store: false,
			currency: true,
		});
	});

	it("falls back to all-false flags when showFilters is not an object", () => {
		expect(
			parsePnlGraphWidgetConfig({ showFilters: null }).showFilters
		).toEqual({
			xAxis: false,
			dateRange: false,
			sessionType: false,
			unit: false,
			store: false,
			currency: false,
		});
	});
});

describe("usePnlGraphWidget", () => {
	function setup(config: Record<string, unknown> = {}) {
		captured.lastInput = null;
		const qc = createClient();
		const view = renderHook(() => usePnlGraphWidget(config), {
			wrapper: wrapper(qc),
		});
		return { qc, view };
	}

	it("seeds runtime state from parsed config defaults", () => {
		const { view } = setup({
			xAxis: "sessionCount",
			sessionType: "tournament",
			storeId: "store-1",
			currencyId: "cur-1",
		});
		expect(view.result.current.state.xAxis).toBe("sessionCount");
		expect(view.result.current.state.sessionType).toBe("tournament");
		expect(view.result.current.state.storeId).toBe("store-1");
		expect(view.result.current.state.currencyId).toBe("cur-1");
	});

	it("passes the raw sessionType filter regardless of unit selection", () => {
		setup({ unit: "normalized", sessionType: "tournament" });
		expect(captured.lastInput?.type).toBe("tournament");
	});

	it("does not filter by type when sessionType=all even under normalized unit", () => {
		setup({ unit: "normalized", sessionType: "all" });
		expect(captured.lastInput?.type).toBeUndefined();
	});

	it("passes undefined type when unit=currency and sessionType=all", () => {
		setup({});
		expect(captured.lastInput?.type).toBeUndefined();
	});

	it("passes raw sessionType when unit=currency", () => {
		setup({ sessionType: "tournament" });
		expect(captured.lastInput?.type).toBe("tournament");
	});

	it("passes optional filters when set", () => {
		setup({ storeId: "s1", ringGameId: "rg1", currencyId: "c1" });
		expect(captured.lastInput?.storeId).toBe("s1");
		expect(captured.lastInput?.ringGameId).toBe("rg1");
		expect(captured.lastInput?.currencyId).toBe("c1");
	});

	it("computes dateFrom from dateRangeDays", () => {
		const before = Math.floor(Date.now() / 1000);
		setup({ dateRangeDays: 7 });
		const after = Math.floor(Date.now() / 1000);
		const expectedMin = before - 7 * 86_400;
		const expectedMax = after - 7 * 86_400;
		expect(captured.lastInput?.dateFrom).toBeGreaterThanOrEqual(expectedMin);
		expect(captured.lastInput?.dateFrom).toBeLessThanOrEqual(expectedMax);
	});

	it("omits dateFrom when dateRangeDays is null", () => {
		setup({});
		expect(captured.lastInput?.dateFrom).toBeUndefined();
	});

	it("aggregates query data into chart points", async () => {
		const qc = createClient();
		const samplePoints = [
			{
				id: "a",
				type: "cash_game",
				sessionDate: 1,
				profitLoss: 50,
				playMinutes: null,
				bigBlind: null,
				buyInTotal: null,
			},
			{
				id: "b",
				type: "cash_game",
				sessionDate: 2,
				profitLoss: -10,
				playMinutes: null,
				bigBlind: null,
				buyInTotal: null,
			},
		];
		qc.setQueryData(
			[
				"session",
				"profitLossSeries",
				{
					type: undefined,
					storeId: undefined,
					ringGameId: undefined,
					currencyId: undefined,
					dateFrom: undefined,
				},
			],
			{ points: samplePoints }
		);
		const { result } = renderHook(
			() => usePnlGraphWidget({ xAxis: "sessionCount" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.points).toHaveLength(2));
		expect(result.current.points[0]?.cumulative).toBe(50);
		expect(result.current.points[1]?.cumulative).toBe(40);
	});

	it("on*Handler setters update runtime state", () => {
		const { view } = setup({});
		act(() => view.result.current.onChangeXAxis("playTime"));
		expect(view.result.current.state.xAxis).toBe("playTime");
		act(() => view.result.current.onChangeUnit("normalized"));
		expect(view.result.current.state.unit).toBe("normalized");
		act(() => view.result.current.onChangeSessionType("cash_game"));
		expect(view.result.current.state.sessionType).toBe("cash_game");
		act(() => view.result.current.onChangeStoreId("s2"));
		expect(view.result.current.state.storeId).toBe("s2");
		act(() => view.result.current.onChangeRingGameId("rg2"));
		expect(view.result.current.state.ringGameId).toBe("rg2");
		act(() => view.result.current.onChangeCurrencyId("c2"));
		expect(view.result.current.state.currencyId).toBe("c2");
		act(() => view.result.current.onChangeDateRangeDays(30));
		expect(view.result.current.state.dateRangeDays).toBe(30);
	});

	it("emits dual-series points (cash + tournament cumulative) when unit=normalized + sessionType=all", async () => {
		const qc = createClient();
		const samplePoints = [
			{
				id: "a",
				type: "cash_game",
				sessionDate: 1,
				profitLoss: 200,
				playMinutes: null,
				bigBlind: 50,
				buyInTotal: null,
			},
			{
				id: "b",
				type: "tournament",
				sessionDate: 2,
				profitLoss: 300,
				playMinutes: null,
				bigBlind: null,
				buyInTotal: 100,
			},
		];
		qc.setQueryData(
			[
				"session",
				"profitLossSeries",
				{
					type: undefined,
					storeId: undefined,
					ringGameId: undefined,
					currencyId: undefined,
					dateFrom: undefined,
				},
			],
			{ points: samplePoints }
		);
		const { result } = renderHook(
			() =>
				usePnlGraphWidget({
					xAxis: "sessionCount",
					unit: "normalized",
					sessionType: "all",
				}),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.points).toHaveLength(2));
		expect(result.current.points[0]?.cashCumulative).toBe(4);
		expect(result.current.points[0]?.tournamentCumulative).toBe(0);
		expect(result.current.points[1]?.cashCumulative).toBe(4);
		expect(result.current.points[1]?.tournamentCumulative).toBe(3);
	});
});
