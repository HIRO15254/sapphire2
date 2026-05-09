import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { asc, eq } from "drizzle-orm";
import type { DbInstance } from "./types";

export function computeBreakMinutes(
	events: { eventType: string; occurredAt: Date }[]
): number {
	let totalBreakMs = 0;
	let pausedAt: Date | null = null;

	for (const event of events) {
		if (event.eventType === "session_pause") {
			pausedAt = event.occurredAt;
		} else if (event.eventType === "session_resume" && pausedAt) {
			totalBreakMs += event.occurredAt.getTime() - pausedAt.getTime();
			pausedAt = null;
		}
	}

	if (pausedAt) {
		totalBreakMs += Date.now() - pausedAt.getTime();
	}

	return Math.floor(totalBreakMs / (1000 * 60));
}

interface SessionLifecycle {
	breakMinutes: number | null;
	endedAt: Date | null;
	startedAt: Date | null;
	status: SessionStatus;
}

export function computeLifecycleFromEvents(
	events: { eventType: string; occurredAt: Date }[]
): SessionLifecycle {
	let startedAt: Date | null = null;
	let endedAt: Date | null = null;
	let lastStateEvent: string | null = null;

	for (const event of events) {
		if (event.eventType === "session_start") {
			if (startedAt === null) {
				startedAt = event.occurredAt;
			}
			lastStateEvent = "session_start";
		} else if (event.eventType === "session_end") {
			endedAt = event.occurredAt;
			lastStateEvent = "session_end";
		} else if (event.eventType === "session_pause") {
			lastStateEvent = "session_pause";
		} else if (event.eventType === "session_resume") {
			lastStateEvent = "session_resume";
		}
	}

	let status: SessionStatus = "active";
	if (lastStateEvent === "session_end") {
		status = "completed";
	} else if (lastStateEvent === "session_pause") {
		status = "paused";
	}

	const breakMs = computeBreakMinutes(events);
	const breakMinutes = breakMs > 0 ? breakMs : null;

	return { status, startedAt, endedAt, breakMinutes };
}

export async function lifecycleProjection(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			occurredAt: sessionEvent.occurredAt,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session) {
		return;
	}

	const lifecycle = computeLifecycleFromEvents(events);

	await db
		.update(gameSession)
		.set({
			status: lifecycle.status,
			startedAt: lifecycle.startedAt ?? session.startedAt,
			endedAt:
				lifecycle.status === "completed" ? (lifecycle.endedAt ?? null) : null,
			breakMinutes: lifecycle.breakMinutes,
			updatedAt: new Date(),
		})
		.where(eq(gameSession.id, sessionId));
}
