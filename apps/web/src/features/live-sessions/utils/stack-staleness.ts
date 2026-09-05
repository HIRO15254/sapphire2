export interface StackStaleness {
	agoText: string;
	tone: "muted" | "warning" | "destructive";
}

function toneForMinutes(minutes: number): StackStaleness["tone"] {
	if (minutes >= 45) {
		return "destructive";
	}
	if (minutes >= 20) {
		return "warning";
	}
	return "muted";
}

function formatAgoText(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return `${hours}h ${remainder}m ago`;
}

export function stackStaleness(
	lastUpdatedAt: Date | string | number | null | undefined,
	now: Date
): StackStaleness {
	if (lastUpdatedAt === null || lastUpdatedAt === undefined) {
		return { agoText: "—", tone: "muted" };
	}
	const last = new Date(lastUpdatedAt);
	if (Number.isNaN(last.getTime())) {
		return { agoText: "—", tone: "muted" };
	}
	const minutes = Math.max(
		0,
		Math.floor((now.getTime() - last.getTime()) / 60_000)
	);
	return { agoText: formatAgoText(minutes), tone: toneForMinutes(minutes) };
}
