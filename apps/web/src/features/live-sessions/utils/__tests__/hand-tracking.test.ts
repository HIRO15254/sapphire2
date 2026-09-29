import { describe, expect, it } from "vitest";
import {
	computeHandsPerHour,
	resolveDealerSeat,
	seatedPositions,
	stepDealerSeat,
} from "@/features/live-sessions/utils/hand-tracking";

describe("seatedPositions", () => {
	it("counts the hero and seated players, never an empty seat", () => {
		expect(
			seatedPositions([
				{ occupancy: "empty", seatPosition: 0 },
				{ occupancy: "player", seatPosition: 1 },
				{ occupancy: "empty", seatPosition: 2 },
				{ occupancy: "hero", seatPosition: 3 },
			])
		).toEqual([1, 3]);
	});
});

describe("resolveDealerSeat", () => {
	it("keeps the stored seat while someone sits there", () => {
		expect(resolveDealerSeat(5, [1, 5, 7])).toBe(5);
	});

	it("hands a vacated seat's button to the next seated player clockwise", () => {
		expect(resolveDealerSeat(3, [1, 5, 7])).toBe(5);
	});

	it("wraps past the last seat to the first seated player", () => {
		expect(resolveDealerSeat(8, [1, 5])).toBe(1);
	});

	it("starts an unplaced button at the first seated player", () => {
		expect(resolveDealerSeat(null, [6, 2, 4])).toBe(2);
	});

	it("has no seat when nobody is seated", () => {
		expect(resolveDealerSeat(3, [])).toBeNull();
		expect(resolveDealerSeat(null, [])).toBeNull();
	});
});

describe("stepDealerSeat", () => {
	it("moves forward past empty seats to the next seated player", () => {
		expect(stepDealerSeat(1, 1, [1, 4, 6])).toBe(4);
		expect(stepDealerSeat(6, 1, [1, 4, 6])).toBe(1);
	});

	it("moves back past empty seats, wrapping to the last seated player", () => {
		expect(stepDealerSeat(4, -1, [1, 4, 6])).toBe(1);
		expect(stepDealerSeat(1, -1, [1, 4, 6])).toBe(6);
	});

	it("steps from where the button is shown when its stored seat was vacated", () => {
		expect(stepDealerSeat(3, 1, [1, 5, 7])).toBe(7);
		expect(stepDealerSeat(3, -1, [1, 5, 7])).toBe(1);
	});

	it("steps from the first seated player when the button was never placed", () => {
		expect(stepDealerSeat(null, 1, [2, 4])).toBe(4);
	});

	it("leaves the button on a lone seated player", () => {
		expect(stepDealerSeat(3, 1, [3])).toBe(3);
		expect(stepDealerSeat(3, -1, [3])).toBe(3);
	});

	it("has nowhere to go when nobody is seated", () => {
		expect(stepDealerSeat(2, 1, [])).toBeNull();
	});

	it("returns to the same seated player after one step forward and one back", () => {
		const tables = [[0, 1], [0, 3, 8], [2, 3, 4, 9], [5]];
		for (const seated of tables) {
			for (const seat of seated) {
				const forward = stepDealerSeat(seat, 1, seated);
				expect(seated).toContain(forward);
				expect(stepDealerSeat(forward, -1, seated)).toBe(seat);
			}
		}
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
