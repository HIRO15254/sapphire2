import { IconCards, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { BlindLevelView } from "@/features/live-sessions/utils/blind-level-view";
import { cn } from "@/lib/utils";
import {
	CRYST_BADGE,
	CRYST_BADGE_TONE,
	CRYST_CARD,
	crystButton,
} from "../cryst-controls";

interface BlindLevelBarProps {
	isStartPending: boolean;
	level: BlindLevelView;
	onStartTimer: () => void;
}

export function BlindLevelBar({
	isStartPending,
	level,
	onStartTimer,
}: BlindLevelBarProps) {
	const clockClass = level.isWarning ? "text-warning" : "text-foreground";

	return (
		<section
			aria-label="Blind level"
			className={cn(
				CRYST_CARD,
				"mx-4 mb-1.5 flex shrink-0 flex-col overflow-hidden"
			)}
		>
			<div className="flex items-center gap-2.5 px-3 py-2">
				<div className="-m-1 min-w-0 flex-1 rounded-md p-1">
					<div className="flex min-w-0 items-center gap-[5px]">
						<span className="shrink-0 text-[length:var(--text-xs)] text-muted-foreground">
							{level.levelLabel}
						</span>
						{level.gameText === null ? null : (
							<span
								className={cn(
									CRYST_BADGE,
									CRYST_BADGE_TONE.info,
									"min-w-0 truncate"
								)}
							>
								<IconCards className="shrink-0" size={12} />
								<span className="truncate">{level.gameText}</span>
							</span>
						)}
					</div>
					<div className="truncate font-mono font-semibold text-[length:var(--text-sm)] tabular-nums">
						{level.blindsText}
						{level.anteText === null ? null : (
							<span className="font-normal text-muted-foreground">
								{" "}
								{level.anteText}
							</span>
						)}
					</div>
				</div>
				<div className="text-right">
					<div
						className={cn(
							"text-[length:var(--text-xs)]",
							level.isWarning && !level.isPaused
								? "text-warning"
								: "text-muted-foreground"
						)}
					>
						{level.stateLabel}
					</div>
					<div
						className={cn(
							"font-mono font-semibold text-[length:var(--text-sm)] tabular-nums",
							clockClass
						)}
					>
						{level.clockText}
					</div>
				</div>
				{level.hasStarted ? null : (
					<button
						aria-label="Start timer"
						className={crystButton({ size: "iconMd", variant: "outline" })}
						disabled={isStartPending}
						onClick={onStartTimer}
						title="Start timer"
						type="button"
					>
						<IconPlayerPlayFilled size={16} />
					</button>
				)}
			</div>
			<div
				aria-label="Level progress"
				aria-valuemax={100}
				aria-valuemin={0}
				aria-valuenow={Math.round(level.progress * 100)}
				className="h-1 shrink-0 bg-muted"
				role="progressbar"
			>
				<div
					className={cn(
						"h-full rounded-r-full transition-[width] duration-[160ms]",
						level.isWarning ? "bg-warning" : "bg-primary"
					)}
					style={{ width: `${level.progress * 100}%` }}
				/>
			</div>
		</section>
	);
}
