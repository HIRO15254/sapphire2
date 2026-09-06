import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/hooks/use-elapsed-time", () => ({
	useElapsedTime: (_startedAt: unknown) => "0:01:00",
}));

import { useCashGameCompactSummary } from "@/features/live-sessions/pages/active-session-page/cash-game-compact-summary/use-cash-game-compact-summary";

const BASE_INPUT = {
	chipRemoveTotal: 0,
	currentStack: 0,
	evDiff: 0,
	startedAt: new Date("2026-01-01T00:00:00Z"),
	totalBuyIn: 0,
};

describe("useCashGameCompactSummary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders a dash and no colour for an unknown P&L", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: null,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPLFormatted).toBe("-");
		expect(result.current.displayPLColorClass).toBe("");
		expect(result.current.showEvPL).toBe(false);
		expect(result.current.evPLFormatted).toBe("");
		expect(result.current.evPLColorClass).toBe("");
		expect(result.current.totalBuyInFormatted).toBe("10k");
	});

	it("formats and colours a known P&L", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: 15_000,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPLFormatted).not.toBe("-");
		expect(result.current.displayPLColorClass.length).toBeGreaterThan(0);
	});

	it("formats and colours the EV row once an all-in makes it differ", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: 12_000,
				evDiff: 500,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.showEvPL).toBe(true);
		expect(result.current.evPLFormatted).not.toBe("");
		expect(result.current.evPLColorClass.length).toBeGreaterThan(0);
	});

	it("formats totalBuyIn via formatCompactNumber (0 → '0')", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				totalBuyIn: 0,
			})
		);
		expect(result.current.totalBuyInFormatted).toBe("0");
	});

	it("threads duration through from useElapsedTime", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				startedAt: new Date("2026-01-01T00:00:00Z"),
			})
		);
		expect(result.current.duration).toBe("0:01:00");
	});
});
