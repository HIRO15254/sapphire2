import type { EntryKind } from "@sapphire2/db/constants/entry";
import { playEventPayloadSchema } from "@sapphire2/db/constants/play-event-payloads";
import type { StoredPlayEvent } from "./entry-live-writes";

export interface PlayEventOutput {
	createdAt: Date;
	entryId: string;
	eventType: string;
	id: string;
	occurredAt: Date;
	payload: Record<string, unknown>;
	playSessionId: string;
	schemaVersion: number;
	sortOrder: number;
	updatedAt: Date;
}

export function toPlayEventOutput(
	kind: EntryKind,
	event: StoredPlayEvent
): PlayEventOutput {
	const raw: unknown = JSON.parse(event.payload);
	const parsed = playEventPayloadSchema(kind, event.type)?.safeParse(raw);
	const payload = (parsed?.success ? parsed.data : raw) as Record<
		string,
		unknown
	>;
	return {
		createdAt: event.createdAt,
		entryId: event.entryId,
		eventType: event.type,
		id: event.id,
		occurredAt: event.occurredAt,
		payload:
			event.handId === null ? payload : { ...payload, handId: event.handId },
		playSessionId: event.playSessionId,
		schemaVersion: event.schemaVersion,
		sortOrder: event.sortOrder,
		updatedAt: event.updatedAt,
	};
}
