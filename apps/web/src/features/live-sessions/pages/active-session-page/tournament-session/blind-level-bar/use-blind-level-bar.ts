import { useState } from "react";
import { useNowTick } from "@/features/live-sessions/hooks/use-now-tick";
import { formatBlindParts } from "@/features/live-sessions/utils/game-scene-formatters";
import {
	computeTournamentTimerState,
	formatTimerDuration,
	type TournamentBlindLevel,
} from "@/features/live-sessions/utils/tournament-timer";
import { formatNumber } from "@/utils/format-number";

const WARNING_THRESHOLD_SECONDS = 60;

export type BlindLevelBarView =
	| { phase: "empty" }
	| { phase: "not-started" }
	| { phase: "complete" }
	| {
			anteText: string | null;
			blindsText: string;
			countdownText: string;
			isCountdownWarning: boolean;
			isStateLabelWarning: boolean;
			isTimerRunning: boolean;
			levelLabel: string;
			onToggleTimerRunning: (event: React.MouseEvent) => void;
			phase: "active";
			progress: number | null;
			runTitle: string;
			stateLabel: string;
	  };

interface UseBlindLevelBarOptions {
	blindLevels: TournamentBlindLevel[];
	isPaused: boolean;
	timerStartedAt: Date | string | number | null;
}

export function useBlindLevelBar({
	blindLevels,
	isPaused,
	timerStartedAt,
}: UseBlindLevelBarOptions): BlindLevelBarView {
	const now = useNowTick(1000);
	const [isTimerRunning, setIsTimerRunning] = useState(true);
	const [pauseAnchorMs, setPauseAnchorMs] = useState<number | null>(null);
	const [pausedTotalMs, setPausedTotalMs] = useState(0);

	const onToggleTimerRunning = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (isTimerRunning) {
			setPauseAnchorMs(Date.now());
			setIsTimerRunning(false);
			return;
		}
		if (pauseAnchorMs !== null) {
			setPausedTotalMs((total) => total + (Date.now() - pauseAnchorMs));
		}
		setPauseAnchorMs(null);
		setIsTimerRunning(true);
	};

	if (blindLevels.length === 0) {
		return { phase: "empty" };
	}

	if (!timerStartedAt) {
		return { phase: "not-started" };
	}

	const effectiveNow = isTimerRunning
		? now - pausedTotalMs
		: (pauseAnchorMs ?? now) - pausedTotalMs;

	const state = computeTournamentTimerState(
		blindLevels,
		timerStartedAt,
		effectiveNow
	);
	const remaining = state.remainingSecondsInLevel;
	const isFinished =
		state.nextLevel === null && remaining !== null && remaining <= 0;

	if (isFinished) {
		return { phase: "complete" };
	}

	const level = state.currentLevel ?? blindLevels[0];
	const isBreak = level?.isBreak ?? false;
	const isWarning =
		remaining !== null && remaining <= WARNING_THRESHOLD_SECONDS;

	return {
		anteText:
			level && !isBreak && level.ante ? anteSuffixFor(level.ante) : null,
		blindsText: level ? blindsTextFor(level, isBreak) : "—",
		countdownText:
			remaining === null ? "—" : formatTimerDuration(Math.max(0, remaining)),
		isCountdownWarning: isBreak || isWarning,
		isStateLabelWarning: isWarning,
		isTimerRunning,
		levelLabel: levelLabelFor(level, isBreak),
		onToggleTimerRunning,
		phase: "active",
		progress: state.levelProgressFraction,
		runTitle: isTimerRunning ? "Pause timer" : "Resume timer",
		stateLabel: stateLabelFor(isPaused, isBreak),
	};
}

function blindsTextFor(level: TournamentBlindLevel, isBreak: boolean): string {
	if (isBreak) {
		return "On break";
	}
	return formatBlindParts(level) || "—";
}

function levelLabelFor(
	level: TournamentBlindLevel | undefined,
	isBreak: boolean
): string {
	if (!level) {
		return "—";
	}
	return isBreak ? "Break" : `Level ${level.level}`;
}

function anteSuffixFor(ante: number): string {
	return `a ${formatNumber(ante)}`;
}

function stateLabelFor(isPaused: boolean, isBreak: boolean): string {
	if (isPaused) {
		return "Paused";
	}
	return isBreak ? "Break ends in" : "Next level in";
}
