import { IconCards, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { BlindLevelView } from "@/features/live-sessions/utils/blind-level-view";
import { cn } from "@/lib/utils";
import {
	CRYST_BADGE,
	CRYST_BADGE_TONE,
	CRYST_CARD,
	CRYST_FOCUS_RING,
	crystButton,
} from "../cryst-controls";

interface BlindLevelBarProps {
	isStartPending: boolean;
	level: BlindLevelView;
	onOpenBlinds: () => void;
	onStartTimer: () => void;
}

export function BlindLevelBar({
	isStartPending,
	level,
	onOpenBlinds,
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
				<button
					className={cn(
						"-m-1 min-w-0 flex-1 rounded-md p-1 text-left transition-colors hover:bg-accent",
						CRYST_FOCUS_RING
					)}
					onClick={onOpenBlinds}
					type="button"
				>
					<span className="flex min-w-0 items-center gap-[5px]">
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
					</span>
					<span className="block truncate font-mono font-semibold text-[length:var(--text-sm)] tabular-nums">
						{level.blindsText}
						{level.anteText === null ? null : (
							<span className="font-normal text-muted-foreground">
								{" "}
								{level.anteText}
							</span>
						)}
					</span>
					<span className="sr-only">Edit blind structure</span>
				</button>
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
