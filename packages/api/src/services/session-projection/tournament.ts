import { tournamentSessionEndPayload } from "@sapphire2/db/constants/session-event-types";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import type { DbInstance } from "./types";

interface TournamentResult {
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	placement: number | null;
	prizeMoney: number | null;
	totalEntries: number | null;
}

export function computeTournamentFromEvents(
	events: { eventType: string; payload: string }[]
): TournamentResult {
	let placement: number | null = null;
	let totalEntries: number | null = null;
	let prizeMoney: number | null = null;
	let bountyPrizes: number | null = null;
	let beforeDeadline = false;

	for (const event of events) {
		if (event.eventType !== "session_end") {
			continue;
		}
		const parsed = JSON.parse(event.payload);
		const result = tournamentSessionEndPayload.safeParse(parsed);
		if (!result.success) {
			continue;
		}
		prizeMoney = result.data.prizeMoney;
		bountyPrizes = result.data.bountyPrizes;
		if (result.data.beforeDeadline === false) {
			placement = result.data.placement;
			totalEntries = result.data.totalEntries;
			beforeDeadline = false;
		} else {
			beforeDeadline = true;
			placement = null;
			totalEntries = null;
		}
	}

	return { placement, totalEntries, prizeMoney, bountyPrizes, beforeDeadline };
}

export async function tournamentProjection(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

	const result = computeTournamentFromEvents(events);

	const [existing] = await db
		.select()
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, sessionId));

	if (existing) {
		await db
			.update(sessionTournamentDetail)
			.set({
				placement: result.placement,
				totalEntries: result.totalEntries,
				beforeDeadline: result.beforeDeadline ? true : null,
				prizeMoney: result.prizeMoney,
				bountyPrizes: result.bountyPrizes,
			})
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	}
}
