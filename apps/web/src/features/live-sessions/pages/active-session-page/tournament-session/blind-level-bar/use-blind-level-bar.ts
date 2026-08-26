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
			levelLabel: string;
			phase: "active";
			progress: number | null;
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

	if (blindLevels.length === 0) {
		return { phase: "empty" };
	}

	if (!timerStartedAt) {
		return { phase: "not-started" };
	}

	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);
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
		levelLabel: level ? `Level ${level.level}` : "—",
		phase: "active",
		progress: state.levelProgressFraction,
		stateLabel: stateLabelFor(isPaused, isBreak),
	};
}

function blindsTextFor(level: TournamentBlindLevel, isBreak: boolean): string {
	if (isBreak) {
		return "Break";
	}
	return formatBlindParts(level) || "—";
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
