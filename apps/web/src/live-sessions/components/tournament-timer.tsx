import { IconClock } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
	computeTournamentTimerState,
	formatBlindLevelLabel,
	formatTimerDuration,
	type TournamentBlindLevel,
} from "@/live-sessions/utils/tournament-timer";
import { Button } from "@/shared/components/ui/button";

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

	if (blindLevels.length === 0) {
		return null;
	}

	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);

	const remaining = state.remainingSecondsInLevel;
	const isBreak = state.currentLevel?.isBreak ?? false;
	const isFinished =
		state.nextLevel === null && remaining !== null && remaining <= 0;
	const mainTime =
		remaining === null ? "—" : formatTimerDuration(Math.max(0, remaining));
	const levelLabel = state.currentLevel
		? formatBlindLevelLabel(state.currentLevel)
		: "—";
	const nextLabel = state.nextLevel
		? formatBlindLevelLabel(state.nextLevel)
		: null;

	return (
		<button
			className={cn(
				"flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/40",
				isBreak &&
					"border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
				isFinished && "border-muted bg-muted/40"
			)}
			onClick={onEditTimer}
			type="button"
		>
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-muted-foreground text-xs">
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
						"font-mono font-semibold text-base tabular-nums",
						isBreak && "text-amber-700 dark:text-amber-300",
						isFinished && "text-muted-foreground"
					)}
				>
					{isFinished ? "DONE" : mainTime}
				</span>
			</div>
		</button>
	);
}
