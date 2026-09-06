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

const MINUTES_PER_HOUR = 60;

function formatAgo(minutes: number): string {
	if (minutes < MINUTES_PER_HOUR) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	return `${hours}h ${minutes % MINUTES_PER_HOUR}m ago`;
}

export function StalenessLine({
	lastUpdateLabel,
	staleness,
}: StalenessLineProps) {
	if (staleness === null || lastUpdateLabel === null) {
		return (
			<div className="flex items-center gap-[5px] text-[11px] text-muted-foreground">
				<IconClockCheck size={12} />
				No stack recorded yet
			</div>
		);
	}

	const { className, Icon } = TONE[staleness.level];

	return (
		<div className={cn("flex items-center gap-[5px] text-[11px]", className)}>
			<Icon size={12} />
			Last update{" "}
			<span className="font-mono tabular-nums">{lastUpdateLabel}</span> ·{" "}
			{formatAgo(staleness.minutesAgo)}
		</div>
	);
}
