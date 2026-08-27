import {
	IconClock,
	IconPlayerPauseFilled,
	IconPlayerPlayFilled,
} from "@tabler/icons-react";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import { cn } from "@/lib/utils";
import { useBlindLevelBar } from "./use-blind-level-bar";

export interface BlindLevelBarProps {
	blindLevels: TournamentBlindLevel[];
	isPaused: boolean;
	onEdit: () => void;
	timerStartedAt: Date | string | number | null;
}

const BAR_CLASS =
	"flex w-full items-center gap-2.5 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card text-left transition-colors hover:bg-accent";

export function BlindLevelBar({
	blindLevels,
	isPaused,
	onEdit,
	timerStartedAt,
}: BlindLevelBarProps) {
	const view = useBlindLevelBar({ blindLevels, isPaused, timerStartedAt });

	if (view.phase === "empty") {
		return null;
	}

	if (view.phase === "not-started") {
		return (
			<button
				className={cn(BAR_CLASS, "px-3 py-2")}
				onClick={onEdit}
				type="button"
			>
				<IconClock className="text-muted-foreground" size={16} />
				<span className="text-muted-foreground text-sm">Start timer</span>
			</button>
		);
	}

	if (view.phase === "complete") {
		return (
			<button
				className={cn(BAR_CLASS, "justify-between px-3 py-2")}
				onClick={onEdit}
				type="button"
			>
				<span className="text-muted-foreground text-sm">
					Structure complete
				</span>
				<span className="font-mono font-semibold text-muted-foreground text-sm tabular-nums">
					DONE
				</span>
			</button>
		);
	}

	return (
		<div className="flex w-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
			<div className="flex items-center gap-2.5 py-2 pr-2 pl-3">
				<button
					className="-m-1 min-w-0 flex-1 rounded-[var(--radius-md)] p-1 text-left hover:bg-accent"
					onClick={onEdit}
					type="button"
				>
					<div className="text-[11px] text-muted-foreground">
						{view.levelLabel}
					</div>
					<div className="truncate font-mono font-semibold text-sm">
						{view.blindsText}
						{view.anteText ? (
							<span className="ml-1 font-normal text-muted-foreground">
								{view.anteText}
							</span>
						) : null}
					</div>
				</button>
				<div className="text-right">
					<div
						className={cn(
							"text-[11px]",
							view.isStateLabelWarning
								? "text-warning"
								: "text-muted-foreground"
						)}
					>
						{view.stateLabel}
					</div>
					<div
						className={cn(
							"font-mono font-semibold text-sm tabular-nums",
							view.isCountdownWarning && "text-warning"
						)}
					>
						{view.countdownText}
					</div>
				</div>
				<button
					className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-transparent hover:bg-accent"
					onClick={view.onToggleTimerRunning}
					title={view.runTitle}
					type="button"
				>
					{view.isTimerRunning ? (
						<IconPlayerPauseFilled
							className="text-muted-foreground"
							size={16}
						/>
					) : (
						<IconPlayerPlayFilled className="text-primary" size={16} />
					)}
				</button>
			</div>
			{view.progress === null ? null : (
				<div
					aria-label="Level progress"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(view.progress * 100)}
					className="h-0.5 w-full flex-shrink-0 bg-muted"
					role="progressbar"
				>
					<div
						className={cn(
							"h-full transition-[width] duration-[250ms] ease-out",
							view.isCountdownWarning ? "bg-warning" : "bg-foreground"
						)}
						style={{ width: `${view.progress * 100}%` }}
					/>
				</div>
			)}
		</div>
	);
}
