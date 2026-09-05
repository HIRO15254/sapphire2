import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";

export function findLastStackUpdateAt(
	events: SessionEvent[]
): SessionEvent["occurredAt"] | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (event?.eventType === "update_stack") {
			return event.occurredAt;
		}
	}
	return null;
}

export function deltaToneOf(
	value: number | null
): "positive" | "negative" | "neutral" {
	if (value === null || value === 0) {
		return "neutral";
	}
	return value > 0 ? "positive" : "negative";
}
