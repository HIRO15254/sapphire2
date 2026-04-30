import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: { list: { queryOptions: () => ({ queryKey: ["session-list"] }) } },
		liveCashGameSession: {
			list: { queryOptions: () => ({ queryKey: ["live-cash"] }) },
		},
		liveTournamentSession: {
			list: { queryOptions: () => ({ queryKey: ["live-tournament"] }) },
		},
		currency: {
			list: { queryOptions: () => ({ queryKey: ["currency-list"] }) },
		},
	},
	trpcClient: {},
}));

import {
	GRID_COLS,
	toLayoutItem,
	useDashboardGrid,
} from "@/features/dashboard/components/dashboard-grid/use-dashboard-grid";
import type { DashboardWidget } from "@/features/dashboard/hooks/use-dashboard-widgets";

function widget(partial: Partial<DashboardWidget>): DashboardWidget {
	return {
		id: "w1",
		type: "summary_stats",
		userId: "u",
		device: "desktop",
		x: 0,
		y: 0,
		w: 2,
		h: 1,
		config: {},
		createdAt: "",
		updatedAt: "",
		...partial,
	};
}

describe("GRID_COLS", () => {
	it("maps mobile to 6 and desktop to 12", () => {
		expect(GRID_COLS).toEqual({ mobile: 6, desktop: 12 });
	});
});

describe("toLayoutItem", () => {
	it("converts a widget to a Layout item using the registry's minSize and device's max cols", () => {
		const w = widget({
			id: "a",
			type: "summary_stats",
			x: 1,
			y: 2,
			w: 6,
			h: 2,
		});
		expect(toLayoutItem(w, "desktop")).toEqual({
			i: "a",
			x: 1,
			y: 2,
			w: 6,
			h: 2,
			minW: 2,
			minH: 2,
			maxW: 12,
		});
	});

	it("uses 6 as maxW on mobile", () => {
		const w = widget({ id: "m", type: "currency_balance" });
		expect(toLayoutItem(w, "mobile").maxW).toBe(6);
	});

	it("falls back minSize to { w: 2, h: 2 } when the widget type is not found", () => {
		const w = widget({
			id: "unknown",
			type: "nonexistent" as unknown as DashboardWidget["type"],
		});
		const item = toLayoutItem(w, "desktop");
		expect(item.minW).toBe(2);
		expect(item.minH).toBe(2);
	});
});

describe("useDashboardGrid", () => {
	it("maps each widget to a Layout item and exposes gridCols for the device", () => {
		const widgets: DashboardWidget[] = [
			widget({ id: "a", x: 0, y: 0, w: 6, h: 2 }),
			widget({
				id: "b",
				type: "currency_balance",
				x: 0,
				y: 2,
				w: 3,
				h: 1,
			}),
		];
		const { result } = renderHook(() => useDashboardGrid(widgets, "desktop"));
		expect(result.current.gridCols).toBe(12);
		expect(result.current.layout).toHaveLength(2);
		expect(result.current.layout[0].i).toBe("a");
		expect(result.current.layout[1].i).toBe("b");
	});

	it("returns an empty layout when there are no widgets", () => {
		const { result } = renderHook(() => useDashboardGrid([], "mobile"));
		expect(result.current.layout).toEqual([]);
		expect(result.current.gridCols).toBe(6);
	});

	it("memoizes the layout for stable inputs", () => {
		const widgets: DashboardWidget[] = [widget({ id: "a" })];
		const { result, rerender } = renderHook(
			({ ws }) => useDashboardGrid(ws, "desktop"),
			{ initialProps: { ws: widgets } }
		);
		const first = result.current.layout;
		rerender({ ws: widgets });
		expect(result.current.layout).toBe(first);
	});
});
