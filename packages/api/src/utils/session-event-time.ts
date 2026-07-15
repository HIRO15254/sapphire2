import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { protectedProcedure } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

export function floorToMinute(date: Date): Date {
	const copy = new Date(date);
	copy.setSeconds(0, 0);
	return copy;
}

// Resolves the `occurredAt` for a session event. Falls back to `now` when the
// caller omits a timestamp — never to a fixed value like `sessionDate`, which
// would collapse every default-timestamped event onto a single instant.
export function resolveOccurredAt(
	occurredAtSeconds: number | undefined,
	now: Date
): Date {
	const raw =
		occurredAtSeconds === undefined ? now : new Date(occurredAtSeconds * 1000);
	return floorToMinute(raw);
}

export function nextAppendSortOrderSql(sessionId: string) {
	return sql<number>`(SELECT COALESCE(MAX(${sessionEvent.sortOrder}), -1) + 1 FROM ${sessionEvent} WHERE ${sessionEvent.sessionId} = ${sessionId})`;
}

export function sessionEventOrderBy() {
	return [
		asc(sessionEvent.occurredAt),
		asc(sessionEvent.sortOrder),
		asc(sessionEvent.id),
	] as const;
}

export function latestSessionEventOrderBy() {
	return [
		desc(sessionEvent.occurredAt),
		desc(sessionEvent.sortOrder),
		desc(sessionEvent.id),
	] as const;
}
function minuteEpoch(date: Date): number {
	return Math.floor(date.getTime() / 60_000);
}

export async function assertAppendOccurredAtOrdering(
	db: DbInstance,
	sessionId: string,
	newOccurredAt: Date
): Promise<void> {
	const [previous] = await db
		.select({ occurredAt: sessionEvent.occurredAt })
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(desc(sessionEvent.sortOrder), desc(sessionEvent.id))
		.limit(1);

	if (
		previous &&
		minuteEpoch(previous.occurredAt) > minuteEpoch(newOccurredAt)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"occurredAt would precede the previous event by minute; reorder via sortOrder instead",
		});
	}
}
export async function assertOccurredAtOrdering(
	db: DbInstance,
	sessionId: string,
	sortOrder: number,
	newOccurredAt: Date
): Promise<void> {
	const target = minuteEpoch(newOccurredAt);

	const [prev] = await db
		.select({ occurredAt: sessionEvent.occurredAt })
		.from(sessionEvent)
		.where(
			and(
				eq(sessionEvent.sessionId, sessionId),
				lt(sessionEvent.sortOrder, sortOrder)
			)
		)
		.orderBy(desc(sessionEvent.sortOrder))
		.limit(1);

	if (prev && minuteEpoch(prev.occurredAt) > target) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"occurredAt would precede the previous event by minute; reorder via sortOrder instead",
		});
	}

	const [next] = await db
		.select({ occurredAt: sessionEvent.occurredAt })
		.from(sessionEvent)
		.where(
			and(
				eq(sessionEvent.sessionId, sessionId),
				gt(sessionEvent.sortOrder, sortOrder)
			)
		)
		.orderBy(asc(sessionEvent.sortOrder))
		.limit(1);

	if (next && minuteEpoch(next.occurredAt) < target) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"occurredAt would follow the next event by minute; reorder via sortOrder instead",
		});
	}
}
