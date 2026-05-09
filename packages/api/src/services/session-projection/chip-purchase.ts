import { purchaseChipsPayload } from "@sapphire2/db/constants/session-event-types";
import {
	sessionChipPurchaseOption,
	sessionChipPurchaseRecord,
} from "@sapphire2/db/schema/session-chip-purchase-option";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { eq } from "drizzle-orm";
import type { DbInstance } from "./types";

export function computeChipPurchaseCounts(
	events: { eventType: string; payload: string }[]
): Map<number, number> {
	const counts = new Map<number, number>();

	for (const event of events) {
		if (event.eventType !== "purchase_chips") {
			continue;
		}
		const parsed = JSON.parse(event.payload);
		const result = purchaseChipsPayload.safeParse(parsed);
		if (!result.success) {
			continue;
		}
		const optionId = Number(result.data.chipPurchaseOptionId);
		counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
	}

	return counts;
}

export async function chipPurchaseProjection(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId));

	const counts = computeChipPurchaseCounts(events);

	await db
		.delete(sessionChipPurchaseRecord)
		.where(eq(sessionChipPurchaseRecord.sessionId, sessionId));

	if (counts.size === 0) {
		return;
	}

	const options = await db
		.select({ id: sessionChipPurchaseOption.id })
		.from(sessionChipPurchaseOption)
		.where(eq(sessionChipPurchaseOption.sessionId, sessionId));

	const validOptionIds = new Set(options.map((o) => o.id));

	const records: {
		sessionId: string;
		chipPurchaseOptionId: number;
		count: number;
	}[] = [];

	for (const [optionId, count] of counts) {
		if (validOptionIds.has(optionId)) {
			records.push({ sessionId, chipPurchaseOptionId: optionId, count });
		}
	}

	if (records.length > 0) {
		await db.insert(sessionChipPurchaseRecord).values(records);
	}
}
