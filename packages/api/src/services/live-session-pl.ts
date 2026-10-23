import { playerJoinPayload } from "@sapphire2/db/constants/session-event-types";

export function computeHeroSeatPositionFromEvents(
	events: { eventType: string; payload: string }[]
): number | null {
	let heroSeat: number | null = null;
	for (const event of events) {
		if (
			event.eventType !== "player_join" &&
			event.eventType !== "player_leave"
		) {
			continue;
		}
		const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
		if (!(parsed.success && parsed.data.isHero)) {
			continue;
		}
		if (event.eventType === "player_join") {
			heroSeat = parsed.data.seatPosition ?? heroSeat;
		} else {
			heroSeat = null;
		}
	}
	return heroSeat;
}
