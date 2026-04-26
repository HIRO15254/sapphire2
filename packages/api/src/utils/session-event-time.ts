import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import type { protectedProcedure } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

export function floorToMinute(date: Date): Date {
	const copy = new Date(date);
	copy.setSeconds(0, 0);
	return copy;
}

function minuteEpoch(date: Date): number {
	return Math.floor(date.getTime() / 60_000);
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
