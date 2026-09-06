export interface SessionClockEvent {
	eventType: string;
	occurredAt: Date | string | number;
}

export interface SessionClock {
	activeSeconds: number;
	pausedSeconds: number;
	pausedSinceMs: number | null;
}

const MS_PER_SECOND = 1000;

function toMs(value: Date | string | number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	return new Date(value).getTime();
}

function toSeconds(ms: number): number {
	return Math.max(0, Math.floor(ms / MS_PER_SECOND));
}

const CLOCK_EVENT_TYPES = new Set([
	"session_start",
	"session_pause",
	"session_resume",
	"session_end",
]);

export function computeSessionClock(
	events: readonly SessionClockEvent[],
	now: Date | number = Date.now()
): SessionClock {
	const timeline = events
		.filter((event) => CLOCK_EVENT_TYPES.has(event.eventType))
		.map((event) => ({
			eventType: event.eventType,
			at: toMs(event.occurredAt),
		}))
		.filter((event) => !Number.isNaN(event.at))
		.sort((a, b) => a.at - b.at);

	const nowMs = toMs(now);
	let activeMs = 0;
	let runningSince: number | null = null;
	let pausedSince: number | null = null;
	let hasEnded = false;

	for (const event of timeline) {
		if (hasEnded) {
			break;
		}
		if (event.eventType === "session_start" && runningSince === null) {
			runningSince = event.at;
		} else if (event.eventType === "session_pause" && runningSince !== null) {
			activeMs += event.at - runningSince;
			runningSince = null;
			pausedSince = event.at;
		} else if (event.eventType === "session_resume" && pausedSince !== null) {
			pausedSince = null;
			runningSince = event.at;
		} else if (event.eventType === "session_end") {
			if (runningSince !== null) {
				activeMs += event.at - runningSince;
			}
			runningSince = null;
			pausedSince = null;
			hasEnded = true;
		}
	}

	if (runningSince !== null) {
		activeMs += nowMs - runningSince;
	}

	return {
		activeSeconds: toSeconds(activeMs),
		pausedSeconds: pausedSince === null ? 0 : toSeconds(nowMs - pausedSince),
		pausedSinceMs: pausedSince,
	};
}
