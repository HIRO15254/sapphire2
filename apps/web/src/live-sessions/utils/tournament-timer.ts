export interface TournamentBlindLevel {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	id: string;
	isBreak: boolean;
	level: number;
	minutes: number | null;
}

export interface TournamentTimerState {
	currentLevel: TournamentBlindLevel | null;
	currentLevelIndex: number;
	elapsedSeconds: number;
	nextLevel: TournamentBlindLevel | null;
	remainingSecondsInLevel: number | null;
	totalDurationSeconds: number | null;
}

const SECONDS_PER_MINUTE = 60;

export function computeTournamentTimerState(
	blindLevels: readonly TournamentBlindLevel[],
	timerStartedAt: Date | string | number,
	now: Date | number = Date.now()
): TournamentTimerState {
	const startMs =
		typeof timerStartedAt === "number"
			? timerStartedAt
			: new Date(timerStartedAt).getTime();
	const nowMs = typeof now === "number" ? now : now.getTime();
	const elapsedSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));

	const sortedLevels = [...blindLevels].sort((a, b) => a.level - b.level);

	const totalDurationSeconds = sortedLevels.every(
		(level) => typeof level.minutes === "number" && level.minutes >= 0
	)
		? sortedLevels.reduce(
				(acc, level) => acc + (level.minutes ?? 0) * SECONDS_PER_MINUTE,
				0
			)
		: null;

	let cumulativeSeconds = 0;
	for (let i = 0; i < sortedLevels.length; i++) {
		const level = sortedLevels[i];
		if (!level) {
			continue;
		}
		const minutes = level.minutes;
		if (typeof minutes !== "number" || minutes <= 0) {
			return {
				currentLevel: level,
				currentLevelIndex: i,
				elapsedSeconds,
				nextLevel: sortedLevels[i + 1] ?? null,
				remainingSecondsInLevel: null,
				totalDurationSeconds,
			};
		}

		const levelEndSeconds = cumulativeSeconds + minutes * SECONDS_PER_MINUTE;
		if (elapsedSeconds < levelEndSeconds) {
			return {
				currentLevel: level,
				currentLevelIndex: i,
				elapsedSeconds,
				nextLevel: sortedLevels[i + 1] ?? null,
				remainingSecondsInLevel: levelEndSeconds - elapsedSeconds,
				totalDurationSeconds,
			};
		}
		cumulativeSeconds = levelEndSeconds;
	}

	const lastLevel = sortedLevels.at(-1) ?? null;
	return {
		currentLevel: lastLevel,
		currentLevelIndex: lastLevel ? sortedLevels.length - 1 : -1,
		elapsedSeconds,
		nextLevel: null,
		remainingSecondsInLevel: 0,
		totalDurationSeconds,
	};
}

export function formatTimerDuration(seconds: number): string {
	const safe = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safe / 3600);
	const minutes = Math.floor((safe % 3600) / 60);
	const secs = safe % 60;
	const mm = String(minutes).padStart(2, "0");
	const ss = String(secs).padStart(2, "0");
	if (hours > 0) {
		return `${hours}:${mm}:${ss}`;
	}
	return `${mm}:${ss}`;
}

export function formatBlindLevelLabel(level: TournamentBlindLevel): string {
	if (level.isBreak) {
		return `Break (L${level.level})`;
	}
	const parts: string[] = [];
	if (level.blind1 !== null) {
		parts.push(String(level.blind1));
	}
	if (level.blind2 !== null) {
		parts.push(String(level.blind2));
	}
	if (level.blind3 !== null) {
		parts.push(String(level.blind3));
	}
	const blindsLabel = parts.length > 0 ? parts.join("/") : "—";
	const anteLabel = level.ante ? ` (ante ${level.ante})` : "";
	return `L${level.level} ${blindsLabel}${anteLabel}`;
}
