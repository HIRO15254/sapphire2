import {
	formatGroupStakes,
	groupDisplayLabel,
} from "@/features/live-sessions/utils/game-scene-formatters";
import {
	computeTournamentTimerState,
	formatBlindsWithAnte,
	formatTimerDuration,
	type TournamentBlindLevel,
} from "@/features/live-sessions/utils/tournament-timer";

export interface BlindLevelView {
	bigBlind: number | null;
	detailText: string | null;
	hasStarted: boolean;
	isBreak: boolean;
	isFinished: boolean;
	levelLabel: string;
	nextText: string | null;
	progress: number | null;
	remainingText: string | null;
}

function levelLabel(level: TournamentBlindLevel): string {
	return level.isBreak ? "Break" : `L${level.level}`;
}

function detailText(level: TournamentBlindLevel): string | null {
	if (level.games && level.games.length > 0) {
		return level.games
			.map((group) => {
				const stakes = formatGroupStakes(group);
				const label = groupDisplayLabel(group);
				return stakes === "—" ? label : `${label} ${stakes}`;
			})
			.join(" · ");
	}
	const blinds = formatBlindsWithAnte(level);
	return blinds === "—" ? null : blinds;
}

function summarize(level: TournamentBlindLevel): string {
	const detail = detailText(level);
	return detail === null
		? levelLabel(level)
		: `${levelLabel(level)} · ${detail}`;
}

function sortByLevel(
	levels: readonly TournamentBlindLevel[]
): TournamentBlindLevel[] {
	return [...levels].sort((a, b) => a.level - b.level);
}

function describeUnstarted(
	levels: readonly TournamentBlindLevel[]
): BlindLevelView | null {
	const sorted = sortByLevel(levels);
	const first = sorted[0];
	if (!first) {
		return null;
	}
	return {
		bigBlind: first.blind2,
		detailText: detailText(first),
		hasStarted: false,
		isBreak: first.isBreak,
		isFinished: false,
		levelLabel: levelLabel(first),
		nextText: sorted[1] ? summarize(sorted[1]) : null,
		progress: null,
		remainingText: null,
	};
}

export function describeBlindLevel(
	blindLevels: readonly TournamentBlindLevel[],
	timerStartedAt: Date | string | number | null,
	now: Date | number
): BlindLevelView | null {
	if (blindLevels.length === 0) {
		return null;
	}
	if (timerStartedAt === null) {
		return describeUnstarted(blindLevels);
	}

	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);
	const current = state.currentLevel;
	if (!current) {
		return null;
	}

	const remaining = state.remainingSecondsInLevel;
	const isFinished =
		state.nextLevel === null && remaining !== null && remaining <= 0;

	return {
		bigBlind: current.blind2,
		detailText: detailText(current),
		hasStarted: true,
		isBreak: current.isBreak,
		isFinished,
		levelLabel: levelLabel(current),
		nextText:
			isFinished || state.nextLevel === null
				? null
				: summarize(state.nextLevel),
		progress: isFinished ? null : state.levelProgressFraction,
		remainingText:
			remaining === null ? null : formatTimerDuration(Math.max(0, remaining)),
	};
}
