import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: { queryOptions: () => ({ queryKey: ["session-list"] }) },
		},
		liveCashGameSession: {
			list: { queryOptions: () => ({ queryKey: ["live-cash-list"] }) },
		},
		liveTournamentSession: {
			list: { queryOptions: () => ({ queryKey: ["live-tournament-list"] }) },
		},
		currency: {
			list: { queryOptions: () => ({ queryKey: ["currency-list"] }) },
		},
		dashboardWidget: {
			list: { queryOptions: () => ({ queryKey: ["widget-list"] }) },
		},
	},
	trpcClient: {},
}));

const { getWidgetEntry, listWidgetTypes, widgetRegistry } = await import(
	"@/features/dashboard/widgets/registry"
);

describe("widget registry", () => {
	it("has entries for all 4 MVP widget types", () => {
		expect(Object.keys(widgetRegistry).sort()).toEqual(
			[
				"active_session",
				"currency_balance",
				"recent_sessions",
				"summary_stats",
			].sort()
		);
	});

	it("lists all widget entries", () => {
		const entries = listWidgetTypes();
		expect(entries).toHaveLength(4);
		for (const entry of entries) {
			expect(entry.label).toBeTruthy();
			expect(entry.Render).toBeTruthy();
			expect(entry.defaultSize.desktop.w).toBeGreaterThan(0);
			expect(entry.defaultSize.mobile.w).toBeGreaterThan(0);
			expect(entry.minSize.w).toBeGreaterThan(0);
		}
	});

	it("returns entry by type", () => {
		expect(getWidgetEntry("summary_stats").type).toBe("summary_stats");
		expect(getWidgetEntry("active_session").type).toBe("active_session");
	});
});
