import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type UseSessionFilterBarProps,
	useSessionFilterBar,
} from "@/features/sessions/components/session-filter-bar/use-session-filter-bar";
import type { SessionFilterValues } from "@/features/sessions/utils/session-filters-helpers";

const rooms = [
	{ id: "r1", name: "Aria" },
	{ id: "r2", name: "Bellagio" },
];
const currencies = [
	{ id: "c1", name: "USD" },
	{ id: "c2", name: "Chips" },
];

function setup(overrides: Partial<UseSessionFilterBarProps> = {}) {
	const onFiltersChange = vi.fn();
	const onBbBiModeChange = vi.fn();
	const props: UseSessionFilterBarProps = {
		bbBiMode: false,
		currencies,
		filters: {} as SessionFilterValues,
		onBbBiModeChange,
		onFiltersChange,
		rooms,
		...overrides,
	};
	const view = renderHook(
		(p: UseSessionFilterBarProps) => useSessionFilterBar(p),
		{
			initialProps: props,
		}
	);
	return { ...view, onFiltersChange, onBbBiModeChange };
}

describe("useSessionFilterBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("sheet open/close", () => {
		it("starts with no active sheet", () => {
			const { result } = setup();
			expect(result.current.activeSheet).toBeNull();
		});

		it("openSheet sets the active sheet", () => {
			const { result } = setup();
			act(() => result.current.openSheet("type"));
			expect(result.current.activeSheet).toBe("type");
		});

		it("openSheet switches between sheets", () => {
			const { result } = setup();
			act(() => result.current.openSheet("type"));
			act(() => result.current.openSheet("date"));
			expect(result.current.activeSheet).toBe("date");
		});

		it("closeSheet clears the active sheet", () => {
			const { result } = setup();
			act(() => result.current.openSheet("room"));
			act(() => result.current.closeSheet());
			expect(result.current.activeSheet).toBeNull();
		});
	});

	describe("onTypeChange", () => {
		it("maps a concrete type and closes the sheet", () => {
			const { result, onFiltersChange } = setup();
			act(() => result.current.openSheet("type"));
			act(() => result.current.onTypeChange("tournament"));
			expect(onFiltersChange).toHaveBeenCalledTimes(1);
			expect(onFiltersChange).toHaveBeenCalledWith({ type: "tournament" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("maps `all` back to undefined", () => {
			const { result, onFiltersChange } = setup({
				filters: { type: "cash_game" },
			});
			act(() => result.current.onTypeChange("all"));
			expect(onFiltersChange).toHaveBeenCalledWith({ type: undefined });
		});

		it("preserves the other active filters when patching", () => {
			const { result, onFiltersChange } = setup({
				filters: { roomId: "r1", currencyId: "c1" },
			});
			act(() => result.current.onTypeChange("cash_game"));
			expect(onFiltersChange).toHaveBeenCalledWith({
				roomId: "r1",
				currencyId: "c1",
				type: "cash_game",
			});
		});
	});

	describe("onRoomChange", () => {
		it("sets the room id and closes the sheet", () => {
			const { result, onFiltersChange } = setup();
			act(() => result.current.openSheet("room"));
			act(() => result.current.onRoomChange("r2"));
			expect(onFiltersChange).toHaveBeenCalledWith({ roomId: "r2" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("clears the room id when passed undefined", () => {
			const { result, onFiltersChange } = setup({ filters: { roomId: "r1" } });
			act(() => result.current.onRoomChange(undefined));
			expect(onFiltersChange).toHaveBeenCalledWith({ roomId: undefined });
		});

		it("clears the room id when passed an empty string", () => {
			const { result, onFiltersChange } = setup({ filters: { roomId: "r1" } });
			act(() => result.current.onRoomChange(""));
			expect(onFiltersChange).toHaveBeenCalledWith({ roomId: undefined });
		});
	});

	describe("onCurrencyChange", () => {
		it("sets the currency id and closes the sheet", () => {
			const { result, onFiltersChange } = setup();
			act(() => result.current.openSheet("currency"));
			act(() => result.current.onCurrencyChange("c1"));
			expect(onFiltersChange).toHaveBeenCalledWith({ currencyId: "c1" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("clears the currency id when passed undefined", () => {
			const { result, onFiltersChange } = setup({
				filters: { currencyId: "c1" },
			});
			act(() => result.current.onCurrencyChange(undefined));
			expect(onFiltersChange).toHaveBeenCalledWith({ currencyId: undefined });
		});
	});

	describe("date handlers", () => {
		it("onDateFromChange patches the lower bound without closing", () => {
			const { result, onFiltersChange } = setup();
			act(() => result.current.openSheet("date"));
			act(() => result.current.onDateFromChange("2026-04-01"));
			expect(onFiltersChange).toHaveBeenCalledWith({ dateFrom: "2026-04-01" });
			expect(result.current.activeSheet).toBe("date");
		});

		it("onDateToChange patches the upper bound without closing", () => {
			const { result, onFiltersChange } = setup();
			act(() => result.current.openSheet("date"));
			act(() => result.current.onDateToChange("2026-04-30"));
			expect(onFiltersChange).toHaveBeenCalledWith({ dateTo: "2026-04-30" });
			expect(result.current.activeSheet).toBe("date");
		});

		it("clears a bound when its input is emptied", () => {
			const { result, onFiltersChange } = setup({
				filters: { dateFrom: "2026-04-01" },
			});
			act(() => result.current.onDateFromChange(""));
			expect(onFiltersChange).toHaveBeenCalledWith({ dateFrom: undefined });
		});

		it("onClearDates wipes both bounds and closes the sheet", () => {
			const { result, onFiltersChange } = setup({
				filters: { dateFrom: "2026-04-01", dateTo: "2026-04-30" },
			});
			act(() => result.current.openSheet("date"));
			act(() => result.current.onClearDates());
			expect(onFiltersChange).toHaveBeenCalledWith({
				dateFrom: undefined,
				dateTo: undefined,
			});
			expect(result.current.activeSheet).toBeNull();
		});
	});

	describe("onDisplayChange", () => {
		it("turns BB/BI on for the normalized option and closes", () => {
			const { result, onBbBiModeChange, onFiltersChange } = setup();
			act(() => result.current.openSheet("display"));
			act(() => result.current.onDisplayChange("normalized"));
			expect(onBbBiModeChange).toHaveBeenCalledTimes(1);
			expect(onBbBiModeChange).toHaveBeenCalledWith(true);
			expect(onFiltersChange).not.toHaveBeenCalled();
			expect(result.current.activeSheet).toBeNull();
		});

		it("turns BB/BI off for the currency option", () => {
			const { result, onBbBiModeChange } = setup({ bbBiMode: true });
			act(() => result.current.onDisplayChange("currency"));
			expect(onBbBiModeChange).toHaveBeenCalledWith(false);
		});
	});

	describe("resolved display names", () => {
		it("resolves the selected room name", () => {
			const { result } = setup({ filters: { roomId: "r2" } });
			expect(result.current.currentRoomName).toBe("Bellagio");
		});

		it("is null when no room is selected", () => {
			const { result } = setup();
			expect(result.current.currentRoomName).toBeNull();
		});

		it("is null when the selected room id is unknown", () => {
			const { result } = setup({ filters: { roomId: "missing" } });
			expect(result.current.currentRoomName).toBeNull();
		});

		it("resolves the selected currency name", () => {
			const { result } = setup({ filters: { currencyId: "c2" } });
			expect(result.current.currentCurrencyName).toBe("Chips");
		});

		it("is null when no currency is selected", () => {
			const { result } = setup();
			expect(result.current.currentCurrencyName).toBeNull();
		});

		it("is null when the selected currency id is unknown", () => {
			const { result } = setup({ filters: { currencyId: "missing" } });
			expect(result.current.currentCurrencyName).toBeNull();
		});
	});
});
