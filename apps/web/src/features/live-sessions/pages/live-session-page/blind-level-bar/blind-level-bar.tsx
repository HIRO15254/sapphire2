import { IconCards, IconPlayerPlayFilled } from "@tabler/icons-react";
import type { BlindLevelView } from "@/features/live-sessions/utils/blind-level-view";
import { cn } from "@/lib/utils";

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
			className="mx-4 mb-1.5 flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
		>
			<div className="flex items-center gap-2.5 px-3 py-2">
				<div className="-m-1 min-w-0 flex-1 rounded-md p-1">
					<div className="flex min-w-0 items-center gap-[5px]">
						<span className="shrink-0 text-[11px] text-muted-foreground">
							{level.levelLabel}
						</span>
						{level.gameText === null ? null : (
							<span className="inline-flex min-w-0 items-center gap-[3px] truncate rounded-full bg-[color-mix(in_oklab,var(--info)_14%,transparent)] px-1.5 py-px font-semibold text-[11px] text-info">
								<IconCards className="shrink-0" size={11} />
								{level.gameText}
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
							"text-[11px]",
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
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent text-primary disabled:opacity-50"
						disabled={isStartPending}
						onClick={onStartTimer}
						title="Start timer"
						type="button"
					>
						<IconPlayerPlayFilled size={16} />
					</button>
				)}
			</div>
			<div className="h-0.5 shrink-0 bg-muted">
				<div
					className={cn(
						"h-full transition-[width] duration-300 ease-out",
						level.isWarning ? "bg-warning" : "bg-foreground"
					)}
					style={{ width: `${level.progress * 100}%` }}
				/>
			</div>
		</section>
	);
}
