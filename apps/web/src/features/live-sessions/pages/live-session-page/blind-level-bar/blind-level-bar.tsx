import { IconPlayerPlay } from "@tabler/icons-react";
import type { BlindLevelView } from "@/features/live-sessions/utils/blind-level-view";
import { cn } from "@/lib/utils";

interface BlindLevelBarProps {
	isStartPending: boolean;
	level: BlindLevelView;
	onStartTimer: () => void;
}

const LEVEL_PILL_BASE =
	"inline-flex shrink-0 items-center rounded-full border px-[7px] py-px font-semibold text-[11px]";

export function BlindLevelBar({
	isStartPending,
	level,
	onStartTimer,
}: BlindLevelBarProps) {
	return (
		<section
			aria-label="Blind level"
			className={cn(
				"mx-[var(--m-inset)] mt-2 shrink-0 overflow-hidden rounded-lg border border-border bg-card",
				level.isBreak &&
					"border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,var(--card))]"
			)}
		>
			<div className="flex items-center gap-2 px-3 py-2">
				<span
					className={cn(
						LEVEL_PILL_BASE,
						level.isBreak
							? "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] text-warning"
							: "border-border text-muted-foreground"
					)}
				>
					{level.levelLabel}
				</span>
				<span className="min-w-0 flex-1 truncate font-mono text-[length:var(--m-text-secondary)] tabular-nums">
					{level.detailText ?? "—"}
				</span>
				{level.hasStarted ? (
					<span
						className={cn(
							"shrink-0 font-mono font-semibold text-[length:var(--m-text-secondary)] tabular-nums",
							level.isBreak && "text-warning",
							level.isFinished && "text-muted-foreground"
						)}
					>
						{level.isFinished ? "Done" : (level.remainingText ?? "—")}
					</span>
				) : (
					<button
						className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-primary px-2.5 py-1 font-semibold text-[11px] text-primary-foreground disabled:opacity-50"
						disabled={isStartPending}
						onClick={onStartTimer}
						type="button"
					>
						<IconPlayerPlay size={13} />
						Start
					</button>
				)}
			</div>
			{level.progress === null ? null : (
				<div
					aria-label="Level progress"
					aria-valuemax={100}
					aria-valuemin={0}
					aria-valuenow={Math.round(level.progress * 100)}
					className="h-1 w-full bg-muted"
					role="progressbar"
				>
					<div
						className={cn(
							"h-full bg-primary transition-[width] duration-1000 ease-linear",
							level.isBreak && "bg-warning"
						)}
						style={{ width: `${level.progress * 100}%` }}
					/>
				</div>
			)}
			{level.nextText === null ? null : (
				<p className="truncate px-3 pt-1 pb-1.5 text-[11px] text-muted-foreground">
					Next: {level.nextText}
				</p>
			)}
		</section>
	);
}
