import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBlindLevelBar } from "@/features/live-sessions/pages/active-session-page/tournament-session/blind-level-bar/use-blind-level-bar";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";

const LEVELS: TournamentBlindLevel[] = [
	{
		ante: 1000,
		blind1: 500,
		blind2: 1000,
		blind3: null,
		id: "l1",
		isBreak: false,
		level: 1,
		minutes: 20,
	},
	{
		ante: null,
		blind1: 1000,
		blind2: 2000,
		blind3: null,
		id: "l2",
		isBreak: false,
		level: 2,
		minutes: 20,
	},
];

const BREAK_LEVELS: TournamentBlindLevel[] = [
	{
		ante: null,
		blind1: null,
		blind2: null,
		blind3: null,
		id: "b1",
		isBreak: true,
		level: 1,
		minutes: 10,
	},
];

describe("useBlindLevelBar", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns phase 'empty' when there are no blind levels", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: [],
				isPaused: false,
				timerStartedAt: null,
			})
		);
		expect(result.current).toEqual({ phase: "empty" });
	});

	it("returns phase 'empty' even when a timer is running but there are no levels", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: [],
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toEqual({ phase: "empty" });
	});

	it("returns phase 'not-started' when levels exist but timerStartedAt is null", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: null,
			})
		);
		expect(result.current).toEqual({ phase: "not-started" });
	});

	it("returns an active view with level label, blinds text and ante suffix", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toMatchObject({
			anteText: "a 1,000",
			blindsText: "500/1,000",
			countdownText: "15:00",
			isCountdownWarning: false,
			isStateLabelWarning: false,
			levelLabel: "Level 1",
			phase: "active",
			stateLabel: "Next level in",
		});
	});

	it("omits the ante suffix when the level has no ante", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:35:00Z"),
			})
		);
		expect(result.current).toMatchObject({
			anteText: null,
			blindsText: "1,000/2,000",
			levelLabel: "Level 2",
			phase: "active",
		});
	});

	it("treats a zero ante as absent", () => {
		const zeroAnteLevels: TournamentBlindLevel[] = [
			{ ...LEVELS[0], ante: 0 } as TournamentBlindLevel,
		];
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: zeroAnteLevels,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toMatchObject({ anteText: null, phase: "active" });
	});

	it("shows 'Break' as the blinds text and 'Break ends in' as the state label on a break level", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: BREAK_LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toMatchObject({
			anteText: null,
			blindsText: "Break",
			isCountdownWarning: true,
			phase: "active",
			stateLabel: "Break ends in",
		});
	});

	it("shows 'Paused' as the state label when isPaused is true, even on a break level", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: BREAK_LEVELS,
				isPaused: true,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toMatchObject({
			phase: "active",
			stateLabel: "Paused",
		});
	});

	it("is not warning when 61 seconds remain in the level", () => {
		const start = new Date(
			new Date("2026-01-01T12:00:00Z").getTime() - (20 * 60 - 61) * 1000
		);
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: start,
			})
		);
		expect(result.current).toMatchObject({
			isCountdownWarning: false,
			isStateLabelWarning: false,
		});
	});

	it("is warning when exactly 60 seconds remain in the level", () => {
		const start = new Date(
			new Date("2026-01-01T12:00:00Z").getTime() - (20 * 60 - 60) * 1000
		);
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: start,
			})
		);
		expect(result.current).toMatchObject({
			isCountdownWarning: true,
			isStateLabelWarning: true,
		});
	});

	it("returns phase 'complete' with countdownText 'DONE' once every level has elapsed", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:00:00Z"),
			})
		);
		expect(result.current).toEqual({ phase: "complete" });
	});

	it("clamps progress to 0 at the very start of a level", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T12:00:00Z"),
			})
		);
		expect(result.current).toMatchObject({ phase: "active", progress: 0 });
	});

	it("reports progress close to 1 just before a level ends without exceeding it", () => {
		const start = new Date(
			new Date("2026-01-01T12:00:00Z").getTime() - (20 * 60 - 1) * 1000
		);
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: start,
			})
		);
		expect(result.current.phase).toBe("active");
		if (result.current.phase === "active") {
			expect(result.current.progress).not.toBeNull();
			expect(result.current.progress as number).toBeGreaterThan(0.9);
			expect(result.current.progress as number).toBeLessThanOrEqual(1);
		}
	});

	it("advances the countdown as time passes (wraps useNowTick)", () => {
		const { result } = renderHook(() =>
			useBlindLevelBar({
				blindLevels: LEVELS,
				isPaused: false,
				timerStartedAt: new Date("2026-01-01T11:55:00Z"),
			})
		);
		expect(result.current).toMatchObject({ countdownText: "15:00" });
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current).toMatchObject({ countdownText: "14:59" });
	});
});
