import { describe, expect, it } from "vitest";
import {
	computeTournamentTimerState,
	formatBlindLevelLabel,
	formatTimerDuration,
	type TournamentBlindLevel,
} from "../tournament-timer";

function makeLevel(
	overrides: Partial<TournamentBlindLevel> & Pick<TournamentBlindLevel, "level">
): TournamentBlindLevel {
	return {
		ante: null,
		blind1: null,
		blind2: null,
		blind3: null,
		id: `lvl-${overrides.level}`,
		isBreak: false,
		minutes: 20,
		...overrides,
	};
}

const LEVELS: TournamentBlindLevel[] = [
	makeLevel({ level: 1, blind1: 100, blind2: 200, minutes: 20 }),
	makeLevel({ level: 2, blind1: 200, blind2: 400, minutes: 20 }),
	makeLevel({ level: 3, isBreak: true, minutes: 10 }),
	makeLevel({ level: 4, blind1: 400, blind2: 800, ante: 800, minutes: 20 }),
];

const T0 = new Date("2026-01-01T12:00:00Z").getTime();

describe("computeTournamentTimerState", () => {
	it("returns level 1 at elapsed=0", () => {
		const state = computeTournamentTimerState(LEVELS, T0, T0);
		expect(state.currentLevel?.level).toBe(1);
		expect(state.elapsedSeconds).toBe(0);
		expect(state.remainingSecondsInLevel).toBe(20 * 60);
		expect(state.nextLevel?.level).toBe(2);
		expect(state.totalDurationSeconds).toBe((20 + 20 + 10 + 20) * 60);
	});

	it("advances to level 2 after 20 minutes", () => {
		const state = computeTournamentTimerState(LEVELS, T0, T0 + 20 * 60 * 1000);
		expect(state.currentLevel?.level).toBe(2);
		expect(state.remainingSecondsInLevel).toBe(20 * 60);
		expect(state.nextLevel?.level).toBe(3);
	});

	it("mid-level countdown is correct", () => {
		const state = computeTournamentTimerState(
			LEVELS,
			T0,
			T0 + 5 * 60 * 1000 + 30_000
		);
		expect(state.currentLevel?.level).toBe(1);
		expect(state.remainingSecondsInLevel).toBe(20 * 60 - 5 * 60 - 30);
	});

	it("identifies break level", () => {
		const state = computeTournamentTimerState(LEVELS, T0, T0 + 45 * 60 * 1000);
		expect(state.currentLevel?.level).toBe(3);
		expect(state.currentLevel?.isBreak).toBe(true);
	});

	it("sorts levels before processing", () => {
		const shuffled = [LEVELS[2], LEVELS[0], LEVELS[3], LEVELS[1]].filter(
			(l): l is TournamentBlindLevel => l !== undefined
		);
		const state = computeTournamentTimerState(
			shuffled,
			T0,
			T0 + 25 * 60 * 1000
		);
		expect(state.currentLevel?.level).toBe(2);
	});

	it("returns null remaining for level with missing minutes", () => {
		const levels = [makeLevel({ level: 1, minutes: null })];
		const state = computeTournamentTimerState(levels, T0, T0 + 5 * 60 * 1000);
		expect(state.remainingSecondsInLevel).toBeNull();
		expect(state.totalDurationSeconds).toBeNull();
	});

	it("returns zero remaining after structure end", () => {
		const state = computeTournamentTimerState(
			LEVELS,
			T0,
			T0 + 2 * 60 * 60 * 1000
		);
		expect(state.remainingSecondsInLevel).toBe(0);
		expect(state.nextLevel).toBeNull();
		expect(state.currentLevel?.level).toBe(4);
	});

	it("clamps negative elapsed time", () => {
		const state = computeTournamentTimerState(LEVELS, T0, T0 - 5000);
		expect(state.elapsedSeconds).toBe(0);
		expect(state.currentLevel?.level).toBe(1);
	});
});

describe("formatTimerDuration", () => {
	it("formats under an hour as mm:ss", () => {
		expect(formatTimerDuration(0)).toBe("00:00");
		expect(formatTimerDuration(59)).toBe("00:59");
		expect(formatTimerDuration(65)).toBe("01:05");
		expect(formatTimerDuration(3599)).toBe("59:59");
	});

	it("formats at or above an hour as h:mm:ss", () => {
		expect(formatTimerDuration(3600)).toBe("1:00:00");
		expect(formatTimerDuration(3661)).toBe("1:01:01");
	});

	it("clamps negative inputs", () => {
		expect(formatTimerDuration(-10)).toBe("00:00");
	});
});

describe("formatBlindLevelLabel", () => {
	it("renders blinds with ante", () => {
		const label = formatBlindLevelLabel(
			makeLevel({ level: 4, blind1: 400, blind2: 800, ante: 800 })
		);
		expect(label).toBe("L4 400/800 (ante 800)");
	});

	it("renders break label", () => {
		const label = formatBlindLevelLabel(makeLevel({ level: 3, isBreak: true }));
		expect(label).toBe("Break (L3)");
	});

	it("falls back when blinds missing", () => {
		const label = formatBlindLevelLabel(makeLevel({ level: 1 }));
		expect(label).toBe("L1 —");
	});
});
