import {
	IconClockCheck,
	IconClockExclamation,
	IconClockPause,
} from "@tabler/icons-react";
import type { Staleness } from "@/features/live-sessions/utils/session-staleness";
import { cn } from "@/lib/utils";

interface StalenessLineProps {
	lastUpdateLabel: string | null;
	staleness: Staleness | null;
}

const TONE = {
	fresh: { className: "text-muted-foreground", Icon: IconClockCheck },
	stale: { className: "text-warning", Icon: IconClockPause },
	critical: { className: "text-destructive", Icon: IconClockExclamation },
} as const;

export function StalenessLine({
	lastUpdateLabel,
	staleness,
}: StalenessLineProps) {
	if (staleness === null || lastUpdateLabel === null) {
		return (
			<p className="flex items-center gap-1 py-1.5 text-[11px] text-muted-foreground">
				<IconClockCheck size={12} />
				No stack recorded yet
			</p>
		);
	}

	const { className, Icon } = TONE[staleness.level];

	return (
		<p className={cn("flex items-center gap-1 py-1.5 text-[11px]", className)}>
			<Icon size={12} />
			Last update{" "}
			<span className="font-mono tabular-nums">{lastUpdateLabel}</span> ·{" "}
			{staleness.minutesAgo}m ago
		</p>
	);
}
