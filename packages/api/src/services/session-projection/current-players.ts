import {
	playerJoinPayload,
	playerLeavePayload,
} from "@sapphire2/db/constants/session-event-types";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { asc, eq } from "drizzle-orm";
import type { DbInstance } from "./types";

export interface CurrentPlayer {
	isHero: boolean;
	joinedAt: Date;
	playerId?: string;
	seatPosition?: number;
}

function identityKey(playerId: string | undefined, isHero: boolean): string {
	return isHero ? "hero" : `player:${playerId}`;
}

export function computeCurrentPlayersFromEvents(
	events: { eventType: string; payload: string; occurredAt: Date }[]
): CurrentPlayer[] {
	const state = new Map<string, CurrentPlayer>();

	for (const event of events) {
		let rawPayload: unknown;
		try {
			rawPayload = JSON.parse(event.payload);
		} catch {
			continue;
		}

		if (event.eventType === "player_join") {
			const parsed = playerJoinPayload.safeParse(rawPayload);
			if (!parsed.success) {
				continue;
			}
			const { playerId, isHero, seatPosition } = parsed.data;
			const key = identityKey(playerId, isHero);
			state.set(key, {
				playerId: isHero ? undefined : playerId,
				isHero,
				seatPosition,
				joinedAt: event.occurredAt,
			});
		} else if (event.eventType === "player_leave") {
			const parsed = playerLeavePayload.safeParse(rawPayload);
			if (!parsed.success) {
				continue;
			}
			const { playerId, isHero } = parsed.data;
			const key = identityKey(playerId, isHero);
			state.delete(key);
		}
	}

	return Array.from(state.values());
}

export async function computeCurrentPlayers(
	db: DbInstance,
	sessionId: string
): Promise<CurrentPlayer[]> {
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
			occurredAt: sessionEvent.occurredAt,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

	return computeCurrentPlayersFromEvents(events);
}
