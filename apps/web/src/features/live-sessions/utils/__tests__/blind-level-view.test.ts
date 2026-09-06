import { describe, expect, it } from "vitest";
import { describeBlindLevel } from "@/features/live-sessions/utils/blind-level-view";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";

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
	makeLevel({ blind1: 100, blind2: 200, level: 1 }),
	makeLevel({ ante: 1000, blind1: 500, blind2: 1000, level: 2 }),
	makeLevel({ isBreak: true, level: 3, minutes: 10 }),
];

const T0 = new Date("2026-01-01T12:00:00Z").getTime();

function at(minutes: number, seconds = 0): number {
	return T0 + minutes * 60_000 + seconds * 1000;
}

describe("describeBlindLevel", () => {
	it("has nothing to show without a blind structure", () => {
		expect(describeBlindLevel([], T0, T0)).toBeNull();
	});

	it("offers the opening level before the timer is started", () => {
		expect(describeBlindLevel(LEVELS, null, T0)).toMatchObject({
			anteText: null,
			blindsText: "100/200",
			clockText: "20:00",
			hasStarted: false,
			levelLabel: "Level 1",
			progress: 0,
			stateLabel: "Not started",
		});
	});

	it("counts the running level down and keeps the ante beside the blinds", () => {
		const view = describeBlindLevel(LEVELS, T0, at(25));
		expect(view).toMatchObject({
			anteText: "a 1,000",
			bigBlind: 1000,
			blindsText: "500/1,000",
			clockText: "15:00",
			hasStarted: true,
			isWarning: false,
			levelLabel: "Level 2",
			stateLabel: "Next level in",
		});
		expect(view?.progress).toBeCloseTo(0.25);
	});

	it("warns in the last minute of a level", () => {
		expect(describeBlindLevel(LEVELS, T0, at(19, 10))).toMatchObject({
			clockText: "00:50",
			isWarning: true,
		});
	});

	it("reads a break as a break and keeps the big blind of the level it follows", () => {
		expect(describeBlindLevel(LEVELS, T0, at(45))).toMatchObject({
			anteText: null,
			bigBlind: 1000,
			blindsText: "On break",
			gameText: null,
			isBreak: true,
			isWarning: true,
			levelLabel: "Break",
			stateLabel: "Break ends in",
		});
	});

	it("takes the big blind from the level ahead when a break opens the structure", () => {
		const opensOnBreak = [
			makeLevel({ isBreak: true, level: 1, minutes: 10 }),
			makeLevel({ blind1: 100, blind2: 200, level: 2 }),
		];
		expect(describeBlindLevel(opensOnBreak, T0, T0)?.bigBlind).toBe(200);
	});

	it("says the clock is held while the session is paused", () => {
		expect(
			describeBlindLevel(LEVELS, T0, at(25), { isPaused: true })
		).toMatchObject({
			isPaused: true,
			stateLabel: "Paused",
		});
	});

	it("stops counting once the structure is exhausted", () => {
		expect(describeBlindLevel(LEVELS, T0, at(90))).toMatchObject({
			progress: 1,
			stateLabel: "Structure complete",
		});
	});

	it("names the variants of a mixed level beside the level", () => {
		const mixed = [
			makeLevel({
				blind1: 100,
				blind2: 200,
				games: [
					{ blind1: 100, blind2: 200, name: "Hold'em", variants: ["NLH"] },
					{
						blind1: 150,
						blind2: 300,
						name: "Omaha",
						variants: ["PLO", "PLO5"],
					},
				],
				level: 1,
			}),
		];
		expect(describeBlindLevel(mixed, T0, T0)).toMatchObject({
			blindsText: "100/200",
			gameText: "NLH · PLO · PLO5",
		});
	});
});
