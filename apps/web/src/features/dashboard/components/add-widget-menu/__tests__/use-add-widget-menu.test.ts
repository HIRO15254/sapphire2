import { act, renderHook } from "@testing-library/react";
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

import { useAddWidgetMenu } from "@/features/dashboard/components/add-widget-menu/use-add-widget-menu";

describe("useAddWidgetMenu", () => {
	it("starts closed and exposes the full list of widget entries", () => {
		const onSelect = vi.fn();
		const { result } = renderHook(() => useAddWidgetMenu(onSelect));
		expect(result.current.open).toBe(false);
		expect(result.current.entries.length).toBeGreaterThan(0);
		const types = result.current.entries.map((e) => e.type);
		expect(types).toContain("summary_stats");
		expect(types).toContain("recent_sessions");
		expect(types).toContain("active_session");
		expect(types).toContain("currency_balance");
	});

	it("handleOpen sets open=true", () => {
		const onSelect = vi.fn();
		const { result } = renderHook(() => useAddWidgetMenu(onSelect));
		act(() => {
			result.current.handleOpen();
		});
		expect(result.current.open).toBe(true);
	});

	it("setOpen allows explicit open state transitions", () => {
		const onSelect = vi.fn();
		const { result } = renderHook(() => useAddWidgetMenu(onSelect));
		act(() => {
			result.current.setOpen(true);
		});
		expect(result.current.open).toBe(true);
		act(() => {
			result.current.setOpen(false);
		});
		expect(result.current.open).toBe(false);
	});

	it("handleSelect closes the menu and calls onSelect with the chosen widget type", () => {
		const onSelect = vi.fn();
		const { result } = renderHook(() => useAddWidgetMenu(onSelect));
		act(() => {
			result.current.setOpen(true);
		});
		act(() => {
			result.current.handleSelect("summary_stats");
		});
		expect(result.current.open).toBe(false);
		expect(onSelect).toHaveBeenCalledWith("summary_stats");
		expect(onSelect).toHaveBeenCalledTimes(1);
	});
});
