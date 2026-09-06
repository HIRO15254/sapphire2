import {
	IconClockCheck,
	IconClockExclamation,
	IconClockPause,
} from "@tabler/icons-react";
import type {
	StackReferenceSource,
	Staleness,
} from "@/features/live-sessions/utils/session-staleness";
import { cn } from "@/lib/utils";

interface StalenessLineProps {
	referenceLabel: string | null;
	source: StackReferenceSource | null;
	staleness: Staleness | null;
}

const TONE = {
	fresh: { className: "text-muted-foreground", Icon: IconClockCheck },
	stale: { className: "text-warning", Icon: IconClockPause },
	critical: { className: "text-destructive", Icon: IconClockExclamation },
} as const;

const SOURCE_LABEL: Record<StackReferenceSource, string> = {
	session_start: "Session start",
	update_stack: "Last update",
};

const MINUTES_PER_HOUR = 60;

function formatAgo(minutes: number): string {
	if (minutes < MINUTES_PER_HOUR) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / MINUTES_PER_HOUR);
	return `${hours}h ${minutes % MINUTES_PER_HOUR}m ago`;
}

export function StalenessLine({
	referenceLabel,
	source,
	staleness,
}: StalenessLineProps) {
	if (staleness === null || referenceLabel === null || source === null) {
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
			{SOURCE_LABEL[source]}{" "}
			<span className="font-mono tabular-nums">{referenceLabel}</span> ·{" "}
			{formatAgo(staleness.minutesAgo)}
		</div>
	);
}
