import { IconClock } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	computeTournamentTimerState,
	formatBlindLevelLabel,
	formatTimerDuration,
	type TournamentBlindLevel,
	type TournamentTimerState,
} from "@/live-sessions/utils/tournament-timer";
import { Button } from "@/shared/components/ui/button";

const SECONDS_PER_MINUTE = 60;

interface TournamentTimerProps {
	blindLevels: readonly TournamentBlindLevel[];
	onEditTimer: () => void;
	timerStartedAt: Date | string | number | null;
}

function useNowTick(intervalMs: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);
	return now;
}

function TimerNotStarted({ onEditTimer }: { onEditTimer: () => void }) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2">
			<div className="flex items-center gap-2 text-muted-foreground text-xs">
				<IconClock size={14} />
				<span>Timer not started</span>
			</div>
			<Button onClick={onEditTimer} size="sm" type="button" variant="outline">
				Start timer
			</Button>
		</div>
	);
}

function computeLevelProgress(state: TournamentTimerState): number | null {
	const remaining = state.remainingSecondsInLevel;
	const minutes = state.currentLevel?.minutes ?? null;
	if (remaining === null || typeof minutes !== "number" || minutes <= 0) {
		return null;
	}
	const total = minutes * SECONDS_PER_MINUTE;
	return Math.min(1, Math.max(0, 1 - remaining / total));
}

function LevelProgressBar({
	isBreak,
	progress,
}: {
	isBreak: boolean;
	progress: number;
}) {
	return (
		<div
			aria-label="Level progress"
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={Math.round(progress * 100)}
			className="h-1 w-full bg-muted"
			role="progressbar"
		>
			<div
				className={cn(
					"h-full bg-primary transition-[width] duration-1000 ease-linear",
					isBreak && "bg-amber-500"
				)}
				style={{ width: `${progress * 100}%` }}
			/>
		</div>
	);
}

interface ActiveTimerProps {
	isBreak: boolean;
	isFinished: boolean;
	levelLabel: string;
	levelProgress: number | null;
	mainTime: string;
	nextLabel: string | null;
	onEditTimer: () => void;
}

function ActiveTimer({
	isBreak,
	isFinished,
	levelLabel,
	levelProgress,
	mainTime,
	nextLabel,
	onEditTimer,
}: ActiveTimerProps) {
	return (
		<button
			className={cn(
				"flex w-full flex-col overflow-hidden rounded-md border text-left transition-colors hover:bg-muted/40",
				isBreak &&
					"border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
				isFinished && "border-muted bg-muted/40"
			)}
			onClick={onEditTimer}
			type="button"
		>
			<div className="flex w-full items-center justify-between gap-3 px-3 py-2">
				<div className="flex min-w-0 flex-col gap-0.5">
					<span
						className={cn(
							"truncate font-bold text-base tabular-nums leading-tight",
							isBreak && "text-amber-800 dark:text-amber-200",
							isFinished && "text-muted-foreground"
						)}
					>
						{isFinished ? "Structure complete" : levelLabel}
					</span>
					{nextLabel && !isFinished ? (
						<span className="truncate text-[10px] text-muted-foreground">
							Next: {nextLabel}
						</span>
					) : null}
				</div>
				<div className="flex items-center gap-2">
					<IconClock
						className={cn("text-muted-foreground", isBreak && "text-amber-600")}
						size={16}
					/>
					<span
						className={cn(
							"font-mono font-semibold text-sm tabular-nums",
							isBreak && "text-amber-700 dark:text-amber-300",
							isFinished && "text-muted-foreground"
						)}
					>
						{isFinished ? "DONE" : mainTime}
					</span>
				</div>
			</div>
			{levelProgress === null ? null : (
				<LevelProgressBar isBreak={isBreak} progress={levelProgress} />
			)}
		</button>
	);
}

export function TournamentTimer({
	blindLevels,
	onEditTimer,
	timerStartedAt,
}: TournamentTimerProps) {
	const now = useNowTick(1000);

	if (!timerStartedAt) {
		if (blindLevels.length === 0) {
			return null;
		}
		return <TimerNotStarted onEditTimer={onEditTimer} />;
	}

	if (blindLevels.length === 0) {
		return null;
	}

	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);
	const remaining = state.remainingSecondsInLevel;
	const isFinished =
		state.nextLevel === null && remaining !== null && remaining <= 0;

	return (
		<ActiveTimer
			isBreak={state.currentLevel?.isBreak ?? false}
			isFinished={isFinished}
			levelLabel={
				state.currentLevel ? formatBlindLevelLabel(state.currentLevel) : "—"
			}
			levelProgress={isFinished ? null : computeLevelProgress(state)}
			mainTime={
				remaining === null ? "—" : formatTimerDuration(Math.max(0, remaining))
			}
			nextLabel={
				state.nextLevel ? formatBlindLevelLabel(state.nextLevel) : null
			}
			onEditTimer={onEditTimer}
		/>
	);
}
