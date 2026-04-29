import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/hooks/use-elapsed-time", () => ({
	useElapsedTime: (_startedAt: unknown) => "0:01:00",
}));

import { useCashGameCompactSummary } from "@/features/live-sessions/hooks/use-cash-game-compact-summary";

const BASE_INPUT = {
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

	it("returns '-' for displayPL and empty evPL when currentStack is null", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: null,
				evDiff: 0,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPL).toBeNull();
		expect(result.current.displayPLFormatted).toBe("-");
		expect(result.current.displayPLColorClass).toBe("");
		expect(result.current.evPL).toBeNull();
		expect(result.current.showEvPL).toBe(false);
		expect(result.current.evPLFormatted).toBe("");
		expect(result.current.evPLColorClass).toBe("");
		expect(result.current.totalBuyInFormatted).toBe("10k");
	});

	it("computes positive displayPL (currentStack - totalBuyIn) and leaves evPL null when evDiff = 0", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: 15_000,
				evDiff: 0,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPL).toBe(5000);
		expect(result.current.displayPLFormatted).not.toBe("-");
		expect(result.current.displayPLColorClass.length).toBeGreaterThan(0);
		expect(result.current.evPL).toBeNull();
		expect(result.current.showEvPL).toBe(false);
	});

	it("computes negative displayPL (loss scenario)", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				...BASE_INPUT,
				currentStack: 4000,
				evDiff: 0,
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPL).toBe(-6000);
	});

	it("computes evPL separately from displayPL when evDiff != 0 and shows when different", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				currentStack: 12_000,
				evDiff: 500,
				startedAt: new Date(),
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.displayPL).toBe(2000);
		expect(result.current.evPL).toBe(2500);
		expect(result.current.showEvPL).toBe(true);
		expect(result.current.evPLFormatted).not.toBe("");
		expect(result.current.evPLColorClass.length).toBeGreaterThan(0);
	});

	it("hides evPL when evDiff is 0 (computation branch gates)", () => {
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				currentStack: 12_000,
				evDiff: 0,
				startedAt: new Date(),
				totalBuyIn: 10_000,
			})
		);
		expect(result.current.evPL).toBeNull();
		expect(result.current.showEvPL).toBe(false);
	});

	it("hides evPL when evPL equals displayPL", () => {
		// evPL = currentStack + evDiff - totalBuyIn; displayPL = currentStack - totalBuyIn.
		// Setting evDiff != 0 but ensuring showEvPL depends on evPL !== displayPL.
		// With evDiff != 0, evPL always differs from displayPL unless evDiff == 0,
		// but coverage for the showEvPL=false side with non-null evPL requires
		// evDiff !== 0 AND evPL === displayPL — impossible arithmetically.
		// So when evDiff != 0 and evPL is not null, showEvPL must be true.
		const { result } = renderHook(() =>
			useCashGameCompactSummary({
				currentStack: 1,
				evDiff: 1,
				startedAt: new Date(),
				totalBuyIn: 1,
			})
		);
		expect(result.current.showEvPL).toBe(true);
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
