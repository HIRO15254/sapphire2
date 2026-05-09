import {
	allInPayload,
	cashSessionEndPayload,
	chipsAddRemovePayload,
} from "@sapphire2/db/constants/session-event-types";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { asc, eq } from "drizzle-orm";
import type { DbInstance } from "./types";

interface CashResult {
	buyIn: number;
	cashOut: number | null;
	evCashOut: number | null;
}

export function computeCashFromEvents(
	events: { eventType: string; payload: string }[]
): CashResult {
	let buyIn = 0;
	let cashOut: number | null = null;
	let totalEvDiff = 0;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);

		if (event.eventType === "chips_add_remove") {
			const data = chipsAddRemovePayload.parse(parsed);
			if (data.amount > 0) {
				buyIn += data.amount;
			}
		} else if (event.eventType === "all_in") {
			const data = allInPayload.parse(parsed);
			totalEvDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
		} else if (event.eventType === "session_end") {
			const data = cashSessionEndPayload.parse(parsed);
			cashOut = data.cashOutAmount;
		}
	}

	const evCashOut = cashOut === null ? null : cashOut + totalEvDiff;

	return { buyIn, cashOut, evCashOut };
}

export async function cashProjection(
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

	const result = computeCashFromEvents(events);

	const [existing] = await db
		.select()
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, sessionId));

	if (existing) {
		await db
			.update(sessionCashDetail)
			.set({
				buyIn: result.buyIn,
				cashOut: result.cashOut,
				evCashOut: result.evCashOut,
			})
			.where(eq(sessionCashDetail.sessionId, sessionId));
	}
}
