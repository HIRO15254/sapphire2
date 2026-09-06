import {
	formatBlindParts,
	type GameGroupLike,
} from "@/features/live-sessions/utils/game-scene-formatters";
import {
	computeTournamentTimerState,
	formatTimerDuration,
	type TournamentBlindLevel,
} from "@/features/live-sessions/utils/tournament-timer";
import { createGroupFormatter } from "@/utils/format-number";

const WARNING_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;

export interface BlindLevelView {
	anteText: string | null;
	bigBlind: number | null;
	blindsText: string;
	clockText: string;
	gameText: string | null;
	hasStarted: boolean;
	isBreak: boolean;
	isPaused: boolean;
	isWarning: boolean;
	levelLabel: string;
	progress: number;
	stateLabel: string;
}

function anteText(level: TournamentBlindLevel): string | null {
	if (level.isBreak || !level.ante) {
		return null;
	}
	const format = createGroupFormatter([
		level.blind1,
		level.blind2,
		level.blind3,
		level.ante,
	]);
	return `a ${format(level.ante)}`;
}

function blindsText(level: TournamentBlindLevel): string {
	if (level.isBreak) {
		return "On break";
	}
	const parts = formatBlindParts(level);
	return parts === "" ? "—" : parts;
}

function gameText(level: TournamentBlindLevel): string | null {
	if (level.isBreak) {
		return null;
	}
	const variants = (level.games ?? []).flatMap(
		(group: GameGroupLike) => group.variants
	);
	return variants.length === 0 ? null : variants.join(" · ");
}

function levelLabel(level: TournamentBlindLevel): string {
	return level.isBreak ? "Break" : `Level ${level.level}`;
}

function resolveBigBlind(
	levels: readonly TournamentBlindLevel[],
	index: number
): number | null {
	const current = levels[index];
	if (!current) {
		return null;
	}
	if (!current.isBreak) {
		return current.blind2;
	}
	for (let i = index - 1; i >= 0; i--) {
		const level = levels[i];
		if (level && !level.isBreak && level.blind2 !== null) {
			return level.blind2;
		}
	}
	for (let i = index + 1; i < levels.length; i++) {
		const level = levels[i];
		if (level && !level.isBreak && level.blind2 !== null) {
			return level.blind2;
		}
	}
	return null;
}

function describeLevel(
	level: TournamentBlindLevel,
	isPaused: boolean,
	bigBlind: number | null
): Omit<
	BlindLevelView,
	"clockText" | "hasStarted" | "isWarning" | "progress" | "stateLabel"
> {
	return {
		anteText: anteText(level),
		bigBlind,
		blindsText: blindsText(level),
		gameText: gameText(level),
		isBreak: level.isBreak,
		isPaused,
		levelLabel: levelLabel(level),
	};
}

function sortByLevel(
	levels: readonly TournamentBlindLevel[]
): TournamentBlindLevel[] {
	return [...levels].sort((a, b) => a.level - b.level);
}

function describeUnstarted(
	levels: readonly TournamentBlindLevel[],
	isPaused: boolean
): BlindLevelView | null {
	const sorted = sortByLevel(levels);
	const first = sorted[0];
	if (!first) {
		return null;
	}
	const minutes = typeof first.minutes === "number" ? first.minutes : 0;
	return {
		...describeLevel(first, isPaused, resolveBigBlind(sorted, 0)),
		clockText: formatTimerDuration(minutes * SECONDS_PER_MINUTE),
		hasStarted: false,
		isWarning: first.isBreak,
		progress: 0,
		stateLabel: "Not started",
	};
}

export function describeBlindLevel(
	blindLevels: readonly TournamentBlindLevel[],
	timerStartedAt: Date | string | number | null,
	now: Date | number,
	options: { isPaused?: boolean } = {}
): BlindLevelView | null {
	const isPaused = options.isPaused ?? false;
	if (blindLevels.length === 0) {
		return null;
	}
	if (timerStartedAt === null) {
		return describeUnstarted(blindLevels, isPaused);
	}

	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);
	const current = state.currentLevel;
	if (!current) {
		return null;
	}

	const remaining = state.remainingSecondsInLevel;
	const isFinished =
		state.nextLevel === null && remaining !== null && remaining <= 0;
	const isWarning =
		!isFinished &&
		(current.isBreak || (remaining !== null && remaining <= WARNING_SECONDS));

	function stateLabel(): string {
		if (isFinished) {
			return "Structure complete";
		}
		if (isPaused) {
			return "Paused";
		}
		return current?.isBreak ? "Break ends in" : "Next level in";
	}

	return {
		...describeLevel(
			current,
			isPaused,
			resolveBigBlind(sortByLevel(blindLevels), state.currentLevelIndex)
		),
		clockText:
			remaining === null ? "—" : formatTimerDuration(Math.max(0, remaining)),
		hasStarted: true,
		isWarning,
		progress: isFinished ? 1 : (state.levelProgressFraction ?? 0),
		stateLabel: stateLabel(),
	};
}
