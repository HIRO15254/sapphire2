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
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/72 backdrop-blur-[2px]">
			<IconPlayerPause className="text-warning" size={26} />
			<span className="font-semibold text-[var(--m-text-secondary)]">
				Session paused
			</span>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
				{elapsedText}
			</span>
			<span className="max-w-[230px] text-pretty text-center text-[var(--m-text-caption)] text-muted-foreground">
				Only notes can be logged while paused.
			</span>
			<div className="mt-1 flex gap-2">
				<button
					className="inline-flex min-h-[var(--m-control)] items-center gap-[7px] rounded-full border border-transparent bg-primary px-4 font-semibold text-[var(--m-text-secondary)] text-primary-foreground hover:brightness-108"
					onClick={onResume}
					type="button"
				>
					<IconPlayerPlay size={17} />
					Resume
				</button>
				<button
					className="inline-flex min-h-[var(--m-control)] items-center gap-[7px] rounded-full border border-border bg-card px-3.5 font-medium text-[var(--m-text-secondary)] text-foreground hover:bg-muted"
					onClick={onNote}
					type="button"
				>
					<IconNote size={17} />
					Note
				</button>
			</div>
		</div>
	);
}
