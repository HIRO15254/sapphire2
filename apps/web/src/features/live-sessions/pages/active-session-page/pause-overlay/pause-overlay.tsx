import { IconNote, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";

interface PauseOverlayProps {
	elapsedText: string;
	onNote: () => void;
	onResume: () => void;
}

export function PauseOverlay({
	elapsedText,
	onNote,
	onResume,
}: PauseOverlayProps) {
	return (
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/75 backdrop-blur-[2px]">
			<IconPlayerPause className="size-6.5 text-warning" />
			<span className="font-semibold text-sm">Session paused</span>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-tight">
				{elapsedText}
			</span>
			<span className="max-w-[230px] text-center text-muted-foreground text-xs">
				Only notes can be logged while paused.
			</span>
			<div className="mt-1 flex gap-2">
				<button
					className="inline-flex min-h-[var(--m-control)] items-center gap-1.5 rounded-full bg-primary px-4 font-semibold text-primary-foreground text-sm hover:brightness-108"
					onClick={onResume}
					type="button"
				>
					<IconPlayerPlay className="size-4" />
					Resume
				</button>
				<button
					className="inline-flex min-h-[var(--m-control)] items-center gap-1.5 rounded-full border border-border bg-card px-3.5 font-medium text-foreground text-sm hover:bg-muted"
					onClick={onNote}
					type="button"
				>
					<IconNote className="size-4" />
					Note
				</button>
			</div>
		</div>
	);
}
