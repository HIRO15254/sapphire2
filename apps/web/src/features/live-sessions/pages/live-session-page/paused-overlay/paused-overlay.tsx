import { IconNote, IconPlayerPause, IconPlayerPlay } from "@tabler/icons-react";
import { Button } from "@/shared/components/ui/button";

interface PausedOverlayProps {
	elapsed: string;
	onResume: () => void;
}

export function PausedOverlay({ elapsed, onResume }: PausedOverlayProps) {
	return (
		<div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[color-mix(in_oklab,var(--background)_72%,transparent)] backdrop-blur-[2px]">
			<IconPlayerPause className="text-warning" size={26} />
			<p className="font-semibold text-[length:var(--text-sm)]">
				Session paused
			</p>
			<p className="font-mono font-semibold text-[22px] tabular-nums">
				{elapsed}
			</p>
			<p className="max-w-[230px] text-center text-[11px] text-muted-foreground">
				Only notes can be logged while paused.
			</p>
			<div className="flex items-center gap-2">
				<Button className="rounded-full" onClick={onResume} type="button">
					<IconPlayerPlay size={16} />
					Resume
				</Button>
				<Button
					className="rounded-full border border-border bg-card"
					disabled
					type="button"
					variant="ghost"
				>
					<IconNote size={16} />
					Note
				</Button>
			</div>
		</div>
	);
}
