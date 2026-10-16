import { playEvent } from "@sapphire2/db/schema/entry";
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

export function resolveOccurredAt(
	occurredAtSeconds: number | undefined,
	now: Date
): Date {
	const raw =
		occurredAtSeconds === undefined ? now : new Date(occurredAtSeconds * 1000);
	return floorToMinute(raw);
}

export function sessionEventOrderBy() {
	return [
		asc(playEvent.occurredAt),
		asc(playEvent.sortOrder),
		asc(playEvent.id),
	] as const;
}

export function latestSessionEventOrderBy() {
	return [
		desc(playEvent.occurredAt),
		desc(playEvent.sortOrder),
		desc(playEvent.id),
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
		.select({ occurredAt: playEvent.occurredAt })
		.from(playEvent)
		.where(eq(playEvent.entryId, sessionId))
		.orderBy(desc(playEvent.sortOrder), desc(playEvent.id))
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
		.select({ occurredAt: playEvent.occurredAt })
		.from(playEvent)
		.where(
			and(eq(playEvent.entryId, sessionId), lt(playEvent.sortOrder, sortOrder))
		)
		.orderBy(desc(playEvent.sortOrder))
		.limit(1);

	if (prev && minuteEpoch(prev.occurredAt) > target) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"occurredAt would precede the previous event by minute; reorder via sortOrder instead",
		});
	}

	const [next] = await db
		.select({ occurredAt: playEvent.occurredAt })
		.from(playEvent)
		.where(
			and(eq(playEvent.entryId, sessionId), gt(playEvent.sortOrder, sortOrder))
		)
		.orderBy(asc(playEvent.sortOrder))
		.limit(1);

	if (next && minuteEpoch(next.occurredAt) < target) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"occurredAt would follow the next event by minute; reorder via sortOrder instead",
		});
	}
}
