import {
	playerJoinPayload,
	playerLeavePayload,
} from "@sapphire2/db/constants/play-event-payloads";

export interface SeatEvent {
	payload: string;
	type: string;
}

export function foldPlayerSeat(
	orderedEvents: readonly SeatEvent[],
	playerId: string
): number | null {
	let seat: number | null = null;
	for (const event of orderedEvents) {
		if (event.type === "player_join") {
			const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
			if (parsed.success && parsed.data.playerId === playerId) {
				seat = parsed.data.seatPosition ?? seat;
			}
		} else if (event.type === "player_leave") {
			const parsed = playerLeavePayload.safeParse(JSON.parse(event.payload));
			if (parsed.success && parsed.data.playerId === playerId) {
				seat = null;
			}
		}
	}
	return seat;
}
