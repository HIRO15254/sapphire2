import { describe, expect, it } from "vitest";
import { heroSeatEventValues } from "../utils/session-event-time";

const NOW = new Date(2026, 5, 1, 22, 41, 37, 500);
const SESSION_ID = "s1";

function build(
	previousHeroSeat: number | null,
	heroSeatPosition: number | null
) {
	return heroSeatEventValues({
		heroSeatPosition,
		now: NOW,
		previousHeroSeat,
		sessionId: SESSION_ID,
	}).map((value) => ({
		eventType: value.eventType,
		occurredAt: value.occurredAt,
		payload: JSON.parse(value.payload) as Record<string, unknown>,
	}));
}

describe("heroSeatEventValues", () => {
	it("records only a join when no seat was taken yet", () => {
		expect(build(null, 6)).toEqual([
			{
				eventType: "player_join",
				occurredAt: new Date(2026, 5, 1, 22, 41),
				payload: { isHero: true, seatPosition: 6 },
			},
		]);
	});

	it("records leaving the old seat before joining the new one", () => {
		expect(build(3, 6)).toEqual([
			{
				eventType: "player_leave",
				occurredAt: new Date(2026, 5, 1, 22, 41),
				payload: { isHero: true },
			},
			{
				eventType: "player_join",
				occurredAt: new Date(2026, 5, 1, 22, 41),
				payload: { isHero: true, seatPosition: 6 },
			},
		]);
	});

	it("records only a leave when the seat is given up", () => {
		expect(build(3, null)).toEqual([
			{
				eventType: "player_leave",
				occurredAt: new Date(2026, 5, 1, 22, 41),
				payload: { isHero: true },
			},
		]);
	});

	it("gives each event its own id", () => {
		const values = heroSeatEventValues({
			heroSeatPosition: 6,
			now: NOW,
			previousHeroSeat: 3,
			sessionId: SESSION_ID,
		});

		expect(values[0]?.id).not.toBe(values[1]?.id);
	});
});
