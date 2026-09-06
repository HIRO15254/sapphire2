export interface StackUpdateEventLike {
	eventType: string;
	occurredAt: Date | string | number;
}

export type StalenessLevel = "critical" | "fresh" | "stale";

export interface Staleness {
	level: StalenessLevel;
	minutesAgo: number;
}

const STALE_AFTER_MINUTES = 20;
const CRITICAL_AFTER_MINUTES = 45;
const MS_PER_MINUTE = 60_000;

function toMs(value: Date | string | number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	return new Date(value).getTime();
}

export function findLastStackUpdateAt(
	events: readonly StackUpdateEventLike[]
): Date | null {
	let latest: number | null = null;
	for (const event of events) {
		if (event.eventType !== "update_stack") {
			continue;
		}
		const ms = toMs(event.occurredAt);
		if (Number.isNaN(ms)) {
			continue;
		}
		if (latest === null || ms > latest) {
			latest = ms;
		}
	}
	return latest === null ? null : new Date(latest);
}

export function describeStaleness(
	lastUpdateAt: Date | null,
	now: Date | number = Date.now()
): Staleness | null {
	if (lastUpdateAt === null) {
		return null;
	}
	const minutesAgo = Math.max(
		0,
		Math.floor((toMs(now) - lastUpdateAt.getTime()) / MS_PER_MINUTE)
	);
	if (minutesAgo >= CRITICAL_AFTER_MINUTES) {
		return { level: "critical", minutesAgo };
	}
	if (minutesAgo >= STALE_AFTER_MINUTES) {
		return { level: "stale", minutesAgo };
	}
	return { level: "fresh", minutesAgo };
}
