import { IconClock } from "@tabler/icons-react";
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
	"flex w-full items-center gap-2.5 overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:bg-accent";

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
		<button
			className="group flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors"
			onClick={onEdit}
			type="button"
		>
			<div className="flex items-center gap-2.5 px-3 py-2">
				<div className="-mx-1 flex min-w-0 flex-col gap-0.5 rounded px-1 group-hover:bg-accent">
					<span className="text-[11px] text-muted-foreground">
						{view.levelLabel}
					</span>
					<span className="truncate font-mono font-semibold text-sm">
						{view.blindsText}
						{view.anteText ? (
							<span className="ml-1 text-muted-foreground">
								{view.anteText}
							</span>
						) : null}
					</span>
				</div>
				<div className="ml-auto flex shrink-0 flex-col items-end gap-0.5">
					<span
						className={cn(
							"text-[11px]",
							view.isStateLabelWarning
								? "text-warning"
								: "text-muted-foreground"
						)}
					>
						{view.stateLabel}
					</span>
					<span
						className={cn(
							"font-mono font-semibold text-sm tabular-nums",
							view.isCountdownWarning && "text-warning"
						)}
					>
						{view.countdownText}
					</span>
				</div>
			</div>
			{view.progress === null ? null : (
				<div
					aria-label="Level progress"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(view.progress * 100)}
					className="h-0.5 w-full bg-muted"
					role="progressbar"
				>
					<div
						className={cn(
							"h-full bg-primary transition-[width]",
							view.isCountdownWarning && "bg-warning"
						)}
						style={{ width: `${view.progress * 100}%` }}
					/>
				</div>
			)}
		</button>
	);
}
