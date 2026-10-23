import { describe, expect, it } from "vitest";
import { computeHeroSeatPositionFromEvents } from "../services/live-session-pl";

describe("computeHeroSeatPositionFromEvents", () => {
	const ev = (eventType: string, payload: Record<string, unknown>) => ({
		eventType,
		payload: JSON.stringify(payload),
	});

	it("returns null when there are no events", () => {
		expect(computeHeroSeatPositionFromEvents([])).toBeNull();
	});

	it("returns null when the hero never joined", () => {
		const events = [ev("player_join", { playerId: "p1", seatPosition: 3 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
	});

	it("returns the hero seat from a hero player_join", () => {
		const events = [ev("player_join", { isHero: true, seatPosition: 6 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBe(6);
	});

	it("returns null after the hero leaves", () => {
		const events = [
			ev("player_join", { isHero: true, seatPosition: 6 }),
			ev("player_leave", { isHero: true }),
		];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
	});

	it("reflects the latest hero seat after a leave and re-join", () => {
		const events = [
			ev("player_join", { isHero: true, seatPosition: 6 }),
			ev("player_leave", { isHero: true }),
			ev("player_join", { isHero: true, seatPosition: 1 }),
		];
		expect(computeHeroSeatPositionFromEvents(events)).toBe(1);
	});

	it("ignores non-hero player events", () => {
		const events = [ev("player_join", { playerId: "p1", seatPosition: 8 })];
		expect(computeHeroSeatPositionFromEvents(events)).toBeNull();
	});
});
