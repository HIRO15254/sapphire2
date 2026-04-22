import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TournamentBlindLevel } from "@/live-sessions/utils/tournament-timer";
import { TournamentTimer } from "./tournament-timer";

const NEXT_LEVEL_PATTERN = /Next: L2 200\/400/;

const LEVELS: TournamentBlindLevel[] = [
	{
		ante: null,
		blind1: 100,
		blind2: 200,
		blind3: null,
		id: "l1",
		isBreak: false,
		level: 1,
		minutes: 20,
	},
	{
		ante: null,
		blind1: 200,
		blind2: 400,
		blind3: null,
		id: "l2",
		isBreak: false,
		level: 2,
		minutes: 20,
	},
];

describe("TournamentTimer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders nothing when there are no blind levels", () => {
		const { container } = render(
			<TournamentTimer
				blindLevels={[]}
				onEditTimer={vi.fn()}
				timerStartedAt={null}
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it("shows 'Timer not started' when structure exists but timerStartedAt is null", () => {
		const onEditTimer = vi.fn();
		render(
			<TournamentTimer
				blindLevels={LEVELS}
				onEditTimer={onEditTimer}
				timerStartedAt={null}
			/>
		);
		expect(screen.getByText("Timer not started")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
		expect(onEditTimer).toHaveBeenCalledTimes(1);
	});

	it("renders countdown when timerStartedAt is set", () => {
		const start = new Date("2026-01-01T11:55:00Z");
		render(
			<TournamentTimer
				blindLevels={LEVELS}
				onEditTimer={vi.fn()}
				timerStartedAt={start}
			/>
		);
		expect(screen.getByText("L1 100/200")).toBeInTheDocument();
		expect(screen.getByText("15:00")).toBeInTheDocument();
		expect(screen.getByText(NEXT_LEVEL_PATTERN)).toBeInTheDocument();
	});

	it("calls onEditTimer when the countdown is clicked", () => {
		const onEditTimer = vi.fn();
		render(
			<TournamentTimer
				blindLevels={LEVELS}
				onEditTimer={onEditTimer}
				timerStartedAt={new Date("2026-01-01T11:55:00Z")}
			/>
		);
		fireEvent.click(screen.getByText("15:00").closest("button") as HTMLElement);
		expect(onEditTimer).toHaveBeenCalledTimes(1);
	});
});
