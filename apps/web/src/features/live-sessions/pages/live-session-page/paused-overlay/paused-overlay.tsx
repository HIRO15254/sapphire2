import { IconNote, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { crystButton } from "../cryst-controls";

interface PausedOverlayProps {
	onNote: () => void;
	onResume: () => void;
	pausedElapsed: string;
}

export function PausedOverlay({
	onNote,
	onResume,
	pausedElapsed,
}: PausedOverlayProps) {
	return (
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_oklab,var(--background)_72%,transparent)] backdrop-blur-[2px]">
			<IconPlayerPause className="text-warning" size={26} />
			<span className="font-semibold text-[length:var(--m-text-secondary)]">
				Session paused
			</span>
			<span className="font-mono font-semibold text-[22px] tabular-nums tracking-[-0.02em]">
				{pausedElapsed}
			</span>
			<span className="max-w-[230px] text-pretty text-center text-[length:var(--m-text-caption)] text-muted-foreground">
				Only notes can be logged while paused.
			</span>
			<div className="mt-1 flex gap-2">
				<button
					className={crystButton({ variant: "primary" })}
					onClick={onResume}
					type="button"
				>
					<IconPlayerPlay size={18} />
					Resume
				</button>
				<button
					className={crystButton({ variant: "outline" })}
					onClick={onNote}
					type="button"
				>
					<IconNote size={18} />
					Note
				</button>
			</div>
		</div>
	);
}
