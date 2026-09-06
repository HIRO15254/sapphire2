import { describe, expect, it } from "vitest";
import {
	computeBigBlinds,
	computeCashGamePL,
} from "@/features/live-sessions/utils/live-session-summary";

const BASE = {
	chipRemoveTotal: 0,
	currentStack: 0,
	evDiff: 0,
	totalBuyIn: 0,
};

describe("computeCashGamePL", () => {
	it("is a win of currentStack - totalBuyIn when nothing was withdrawn", () => {
		expect(
			computeCashGamePL({
				...BASE,
				currentStack: 15_000,
				totalBuyIn: 10_000,
			}).displayPL
		).toBe(5000);
	});

	it("is a loss when the stack is below the buy-in", () => {
		expect(
			computeCashGamePL({ ...BASE, currentStack: 4000, totalBuyIn: 10_000 })
				.displayPL
		).toBe(-6000);
	});

	it("credits withdrawn chips back into the result (400 + 300 - 500 = 200)", () => {
		expect(
			computeCashGamePL({
				...BASE,
				chipRemoveTotal: 300,
				currentStack: 400,
				totalBuyIn: 500,
			}).displayPL
		).toBe(200);
	});

	it("is unknown while the current stack is unknown", () => {
		const result = computeCashGamePL({
			...BASE,
			chipRemoveTotal: 300,
			currentStack: null,
			evDiff: 200,
			totalBuyIn: 500,
		});
		expect(result.displayPL).toBeNull();
		expect(result.evPL).toBeNull();
		expect(result.showEvPL).toBe(false);
	});

	it("adds the all-in EV difference on top of the same expression", () => {
		const result = computeCashGamePL({
			...BASE,
			currentStack: 12_000,
			evDiff: 500,
			totalBuyIn: 10_000,
		});
		expect(result.displayPL).toBe(2000);
		expect(result.evPL).toBe(2500);
		expect(result.showEvPL).toBe(true);
	});

	it("credits withdrawn chips into the EV result too (400 + 300 + 100 - 500 = 300)", () => {
		const result = computeCashGamePL({
			...BASE,
			chipRemoveTotal: 300,
			currentStack: 400,
			evDiff: 100,
			totalBuyIn: 500,
		});
		expect(result.displayPL).toBe(200);
		expect(result.evPL).toBe(300);
	});

	it("has no EV result to show when no all-in was recorded", () => {
		const result = computeCashGamePL({
			...BASE,
			currentStack: 12_000,
			evDiff: 0,
			totalBuyIn: 10_000,
		});
		expect(result.evPL).toBeNull();
		expect(result.showEvPL).toBe(false);
	});

	it("shows a negative EV difference that drags the EV result below the result", () => {
		const result = computeCashGamePL({
			...BASE,
			currentStack: 12_000,
			evDiff: -800,
			totalBuyIn: 10_000,
		});
		expect(result.displayPL).toBe(2000);
		expect(result.evPL).toBe(1200);
		expect(result.showEvPL).toBe(true);
	});
});

describe("computeBigBlinds", () => {
	it("rounds the stack to the nearest big blind", () => {
		expect(computeBigBlinds(12_500, 400)).toBe(31);
	});

	it("is unknown while the stack is unknown", () => {
		expect(computeBigBlinds(null, 400)).toBeNull();
	});

	it("is unknown when the level carries no big blind", () => {
		expect(computeBigBlinds(12_500, null)).toBeNull();
		expect(computeBigBlinds(12_500, 0)).toBeNull();
	});
});
