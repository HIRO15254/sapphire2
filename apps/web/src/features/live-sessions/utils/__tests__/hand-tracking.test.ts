import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import { describe, expect, it } from "vitest";
import {
	computeHandsPerHour,
	dealerSeatIndex,
	dealerSpot,
	shiftDealerOffset,
} from "@/features/live-sessions/utils/hand-tracking";

describe("dealerSeatIndex", () => {
	it("advances one seat per hand and wraps at the table size", () => {
		expect(dealerSeatIndex(0, 0, 9)).toBe(0);
		expect(dealerSeatIndex(1, 0, 9)).toBe(1);
		expect(dealerSeatIndex(9, 0, 9)).toBe(0);
		expect(dealerSeatIndex(10, 0, 6)).toBe(4);
	});

	it("treats an uncounted session as hand zero", () => {
		expect(dealerSeatIndex(null, 2, 9)).toBe(2);
	});

	it("adds the drift correction on top of the hand count", () => {
		expect(dealerSeatIndex(3, 2, 6)).toBe(5);
		expect(dealerSeatIndex(4, 2, 6)).toBe(0);
	});

	it("keeps a heads-up button alternating between the two seats", () => {
		expect(dealerSeatIndex(0, 0, 2)).toBe(0);
		expect(dealerSeatIndex(1, 0, 2)).toBe(1);
		expect(dealerSeatIndex(2, 0, 2)).toBe(0);
	});

	it("has no seat to point at when the table has none", () => {
		expect(dealerSeatIndex(5, 0, 0)).toBeNull();
	});
});

describe("shiftDealerOffset", () => {
	it("moves the button back from seat one to the last seat", () => {
		expect(shiftDealerOffset(0, -1, 9)).toBe(8);
	});

	it("moves the button forward from the last seat to seat one", () => {
		expect(shiftDealerOffset(8, 1, 9)).toBe(0);
	});

	it("undoes a back step with a forward step", () => {
		const back = shiftDealerOffset(3, -1, 6);
		expect(shiftDealerOffset(back, 1, 6)).toBe(3);
	});

	it("normalises an offset saved for a larger table into the current one", () => {
		expect(shiftDealerOffset(7, 1, 6)).toBe(2);
	});

	it("always stays inside the range the server accepts", () => {
		for (let seats = 2; seats <= 10; seats++) {
			for (let offset = 0; offset <= MAX_SEAT_POSITION; offset++) {
				for (const step of [-1, 1]) {
					const next = shiftDealerOffset(offset, step, seats);
					expect(next).toBeGreaterThanOrEqual(0);
					expect(next).toBeLessThanOrEqual(
						Math.min(seats - 1, MAX_SEAT_POSITION)
					);
				}
			}
		}
	});
});

describe("dealerSpot", () => {
	it("sits 34% of the way from the seat toward the table centre", () => {
		const seat = { x: 14.5, y: 63 };
		const spot = dealerSpot(seat);
		expect(50 - spot.x).toBeCloseTo((50 - seat.x) * 0.66);
		expect(spot.y - 50).toBeCloseTo((seat.y - 50) * 0.66);
	});

	it("leaves a seat already on the centre line on that line", () => {
		expect(dealerSpot({ x: 50, y: 14.2 }).x).toBe(50);
	});
});

describe("computeHandsPerHour", () => {
	it("divides the hands by the active hours", () => {
		expect(computeHandsPerHour(30, 3600)).toBe(30);
		expect(computeHandsPerHour(45, 5400)).toBe(30);
	});

	it("rounds to a whole hand", () => {
		expect(computeHandsPerHour(10, 1800 + 60)).toBe(19);
	});

	it("reports zero for a counted-but-empty hour", () => {
		expect(computeHandsPerHour(null, 7200)).toBe(0);
	});

	it("has no rate during the first minute", () => {
		expect(computeHandsPerHour(3, 59)).toBeNull();
		expect(computeHandsPerHour(3, 60)).toBe(180);
	});
});
