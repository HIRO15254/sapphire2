import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type { StatsSectionContext } from "@/features/statistics/types";

const trpcMocks = vi.hoisted(() => ({ breakdownQueryFn: vi.fn() }));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		stats: {
			breakdown: {
				queryOptions: (input: unknown, opts?: { enabled?: boolean }) => ({
					queryKey: ["stats", "breakdown", input],
					queryFn: () => trpcMocks.breakdownQueryFn(input),
					enabled: opts?.enabled,
				}),
			},
		},
	},
}));

import { useBreakdownSection } from "@/features/statistics/pages/statistics-page/breakdown-section/use-breakdown-section";

interface BreakdownRow {
	cashNormalizedProfitLoss: number | null;
	key: string;
	label: string;
	playMinutes: number;
	profitLoss: number;
	sessions: number;
	tournamentNormalizedProfitLoss: number | null;
}

function breakdownRow(overrides: Partial<BreakdownRow> = {}): BreakdownRow {
	return {
		key: "wsop",
		label: "WSOP",
		sessions: 5,
		profitLoss: 1500,
		cashNormalizedProfitLoss: null,
		tournamentNormalizedProfitLoss: null,
		playMinutes: 600,
		...overrides,
	};
}

function ctx(
	overrides: Partial<StatsSectionContext> = {}
): StatsSectionContext {
	return {
		statsInput: { normalized: false, currencyId: "c1" },
		enabled: true,
		normalized: false,
		currencyUnit: "USD",
		type: "all",
		...overrides,
	};
}

function renderBreakdown(context: StatsSectionContext) {
	return renderHook(
		(props: StatsSectionContext) => useBreakdownSection(props),
		{
			initialProps: context,
			wrapper: withQueryClient(createTestQueryClient()),
		}
	);
}

async function renderLoadedBreakdown(context: StatsSectionContext) {
	const view = renderBreakdown(context);
	await waitFor(() => expect(view.result.current.isPending).toBe(false));
	return view;
}

/** Pull the `groupBy` from the single captured query input arg. */
function lastGroupBy(): unknown {
	const calls = trpcMocks.breakdownQueryFn.mock.calls;
	const lastInput = calls.at(-1)?.[0] as { groupBy?: unknown } | undefined;
	return lastInput?.groupBy;
}

describe("useBreakdownSection", () => {
	it("defaults the active tab to room", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		expect(result.current.activeTab).toBe("room");
		expect(lastGroupBy()).toBe("room");
	});

	it("offers room, day of week, length, and month tabs for the 'all' type", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		expect(result.current.tabs.map((t) => t.value)).toEqual([
			"room",
			"dayOfWeek",
			"length",
			"month",
		]);
		expect(result.current.tabs.map((t) => t.label)).toEqual([
			"Room",
			"Day of week",
			"Length",
			"Month",
		]);
	});

	it("includes the stakes tab only for cash game", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "cash_game" }));
		expect(result.current.tabs.map((t) => t.value)).toEqual([
			"room",
			"stakes",
			"dayOfWeek",
			"length",
			"month",
		]);
		const stakes = result.current.tabs.find((t) => t.value === "stakes");
		expect(stakes?.label).toBe("Stakes");
	});

	it("omits the stakes tab for the tournament type", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "tournament" }));
		expect(result.current.tabs.map((t) => t.value)).not.toContain("stakes");
	});

	it("forwards the selected grouping to the query when the tab changes", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));

		act(() => {
			result.current.setActiveTab("month");
		});

		await waitFor(() => expect(result.current.activeTab).toBe("month"));
		await waitFor(() => expect(lastGroupBy()).toBe("month"));
	});

	it("falls back to room when stakes is active and the type leaves cash game", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result, rerender } = await renderLoadedBreakdown(
			ctx({ type: "cash_game" })
		);

		act(() => {
			result.current.setActiveTab("stakes");
		});
		await waitFor(() => expect(result.current.activeTab).toBe("stakes"));
		await waitFor(() => expect(lastGroupBy()).toBe("stakes"));

		rerender(ctx({ type: "tournament" }));

		await waitFor(() => expect(result.current.activeTab).toBe("room"));
		await waitFor(() => expect(lastGroupBy()).toBe("room"));
		expect(result.current.tabs.map((t) => t.value)).not.toContain("stakes");
	});

	it("formats a positive row's view model with sign, unit, and success color", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [breakdownRow()],
		});
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		expect(result.current.rows).toHaveLength(1);
		const row = result.current.rows[0];
		expect(row.key).toBe("wsop");
		expect(row.label).toBe("WSOP");
		expect(row.sessions).toBe(5);
		expect(row.netText).toBe("+1,500 USD");
		expect(row.netColor).toBe("text-green-600 dark:text-green-400");
		expect(row.playTimeText).toBe("10h");
	});

	it("formats a negative row with the destructive color", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [breakdownRow({ profitLoss: -500 })],
		});
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		const row = result.current.rows[0];
		expect(row.netText).toBe("-500 USD");
		expect(row.netColor).toBe("text-red-600 dark:text-red-400");
	});

	it("formats a break-even row with no color class", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [breakdownRow({ profitLoss: 0 })],
		});
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		const row = result.current.rows[0];
		expect(row.netText).toBe("+0 USD");
		expect(row.netColor).toBe("");
	});

	it("exposes separate bb and bi columns when normalized for all types", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [
				breakdownRow({
					cashNormalizedProfitLoss: 30,
					tournamentNormalizedProfitLoss: 3,
				}),
			],
		});
		const { result } = await renderLoadedBreakdown(
			ctx({ type: "all", normalized: true, currencyUnit: null })
		);
		expect(result.current.normalized).toBe(true);
		expect(result.current.showCashColumn).toBe(true);
		expect(result.current.showTournamentColumn).toBe(true);
		expect(result.current.rows[0].cashText).toBe("+30 bb");
		expect(result.current.rows[0].tournamentText).toBe("+3 bi");
	});

	it("hides the bi column when no group has a tournament figure", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [breakdownRow({ cashNormalizedProfitLoss: 30 })],
		});
		const { result } = await renderLoadedBreakdown(
			ctx({ type: "cash_game", normalized: true, currencyUnit: null })
		);
		expect(result.current.showCashColumn).toBe(true);
		expect(result.current.showTournamentColumn).toBe(false);
		expect(result.current.rows[0].tournamentText).toBe("—");
	});

	it("returns no rows when the server omits all groups", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({ groups: [] });
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		expect(result.current.rows).toEqual([]);
	});

	it("does not query and stays settled when the scope is disabled", () => {
		trpcMocks.breakdownQueryFn.mockReset();
		const { result } = renderBreakdown(ctx({ enabled: false }));
		expect(result.current.rows).toEqual([]);
		expect(result.current.isPending).toBe(false);
		expect(trpcMocks.breakdownQueryFn).not.toHaveBeenCalled();
	});

	it("maps multiple groups in order", async () => {
		trpcMocks.breakdownQueryFn.mockReset();
		trpcMocks.breakdownQueryFn.mockResolvedValue({
			groups: [
				breakdownRow({ key: "a", label: "Aria", profitLoss: 100 }),
				breakdownRow({ key: "b", label: "Bellagio", profitLoss: -100 }),
			],
		});
		const { result } = await renderLoadedBreakdown(ctx({ type: "all" }));
		expect(result.current.rows.map((r) => r.key)).toEqual(["a", "b"]);
		expect(result.current.rows.map((r) => r.netText)).toEqual([
			"+100 USD",
			"-100 USD",
		]);
	});
});
