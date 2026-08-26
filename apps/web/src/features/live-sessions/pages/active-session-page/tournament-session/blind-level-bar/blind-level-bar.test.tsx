import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import { BlindLevelBar } from "./blind-level-bar";

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

describe("BlindLevelBar", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("renders nothing when there are no blind levels", () => {
		const { container } = render(
			<BlindLevelBar
				blindLevels={[]}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={null}
			/>
		);
		expect(container.firstChild).toBeNull();
	});

	it("shows the 'Start timer' affordance when timerStartedAt is null", () => {
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={null}
			/>
		);
		expect(screen.getByText("Start timer")).toBeInTheDocument();
	});

	it("calls onEdit exactly once when the 'Start timer' row is tapped", () => {
		const onEdit = vi.fn();
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={onEdit}
				timerStartedAt={null}
			/>
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("renders the level, blinds and countdown while the timer is running", () => {
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={new Date("2026-01-01T11:55:00Z")}
			/>
		);
		expect(screen.getByText("Level 1")).toBeInTheDocument();
		expect(screen.getByText("100/200")).toBeInTheDocument();
		expect(screen.getByText("15:00")).toBeInTheDocument();
		expect(screen.getByText("Next level in")).toBeInTheDocument();
	});

	it("calls onEdit exactly once when the running bar is tapped", () => {
		const onEdit = vi.fn();
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={onEdit}
				timerStartedAt={new Date("2026-01-01T11:55:00Z")}
			/>
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("shows 'Paused' as the state label when isPaused is true", () => {
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused
				onEdit={vi.fn()}
				timerStartedAt={new Date("2026-01-01T11:55:00Z")}
			/>
		);
		expect(screen.getByText("Paused")).toBeInTheDocument();
		expect(screen.queryByText("Next level in")).not.toBeInTheDocument();
	});

	it("applies warning styling to the countdown on a break level", () => {
		render(
			<BlindLevelBar
				blindLevels={BREAK_LEVELS}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={new Date("2026-01-01T11:55:00Z")}
			/>
		);
		expect(screen.getByText("Break ends in")).toBeInTheDocument();
		expect(screen.getByText("05:00")).toHaveClass("text-warning");
		expect(screen.getByRole("progressbar")).toHaveClass("bg-muted");
	});

	it("renders 'Structure complete' and 'DONE' once every level has elapsed", () => {
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={new Date("2026-01-01T11:00:00Z")}
			/>
		);
		expect(screen.getByText("Structure complete")).toBeInTheDocument();
		expect(screen.getByText("DONE")).toBeInTheDocument();
	});

	it("calls onEdit exactly once when the completed bar is tapped", () => {
		const onEdit = vi.fn();
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={onEdit}
				timerStartedAt={new Date("2026-01-01T11:00:00Z")}
			/>
		);
		fireEvent.click(screen.getByRole("button"));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});

	it("does not render a progress track once the structure is complete", () => {
		render(
			<BlindLevelBar
				blindLevels={LEVELS}
				isPaused={false}
				onEdit={vi.fn()}
				timerStartedAt={new Date("2026-01-01T11:00:00Z")}
			/>
		);
		expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
	});
});
