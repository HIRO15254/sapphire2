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
	makeLevel({ ante: 400, blind1: 200, blind2: 400, level: 2 }),
	makeLevel({ isBreak: true, level: 3, minutes: 10 }),
];

const T0 = new Date("2026-01-01T12:00:00Z").getTime();

function at(minutes: number): number {
	return T0 + minutes * 60_000;
}

describe("describeBlindLevel", () => {
	it("has nothing to show without a blind structure", () => {
		expect(describeBlindLevel([], T0, T0)).toBeNull();
	});

	it("offers the opening level before the timer is started", () => {
		const view = describeBlindLevel(LEVELS, null, T0);
		expect(view).toMatchObject({
			detailText: "100 / 200",
			hasStarted: false,
			levelLabel: "L1",
			progress: null,
			remainingText: null,
		});
		expect(view?.nextText).toBe("L2 · 200 / 400 (ante 400)");
	});

	it("counts the running level down and names the next one", () => {
		const view = describeBlindLevel(LEVELS, T0, at(25));
		expect(view).toMatchObject({
			bigBlind: 400,
			detailText: "200 / 400 (ante 400)",
			hasStarted: true,
			isFinished: false,
			levelLabel: "L2",
			remainingText: "15:00",
		});
		expect(view?.nextText).toBe("Break");
		expect(view?.progress).toBeCloseTo(0.25);
	});

	it("reads a break as a break with no blinds", () => {
		const view = describeBlindLevel(LEVELS, T0, at(45));
		expect(view).toMatchObject({
			detailText: null,
			isBreak: true,
			levelLabel: "Break",
		});
	});

	it("stops counting once the structure is exhausted", () => {
		const view = describeBlindLevel(LEVELS, T0, at(90));
		expect(view).toMatchObject({
			isFinished: true,
			nextText: null,
			progress: null,
		});
	});

	it("shows the per-group stakes of a mixed level instead of flat blinds", () => {
		const mixed = [
			makeLevel({
				games: [
					{ blind1: 100, blind2: 200, name: "Hold'em", variants: ["NLH"] },
					{ blind1: 150, blind2: 300, name: "Omaha", variants: ["PLO"] },
				],
				level: 1,
			}),
		];
		expect(describeBlindLevel(mixed, T0, T0)?.detailText).toBe(
			"Hold'em 100/200 · Omaha 150/300"
		);
	});
});
