import { describe, expect, it } from "vitest";
import { floorToMinute } from "../session-event-time";

describe("floorToMinute", () => {
	it("zeroes out seconds and milliseconds", () => {
		const input = new Date("2026-04-24T12:34:56.789Z");
		const result = floorToMinute(input);
		expect(result.toISOString()).toBe("2026-04-24T12:34:00.000Z");
	});

	it("is a no-op when seconds and ms are already zero", () => {
		const input = new Date("2026-04-24T00:00:00.000Z");
		const result = floorToMinute(input);
		expect(result.getTime()).toBe(input.getTime());
	});

	it("does not mutate the original Date", () => {
		const input = new Date("2026-04-24T12:34:56.789Z");
		const original = input.getTime();
		floorToMinute(input);
		expect(input.getTime()).toBe(original);
	});

	it("preserves hours and date even when the second is 59", () => {
		const input = new Date("2026-04-24T23:59:59.999Z");
		const result = floorToMinute(input);
		expect(result.toISOString()).toBe("2026-04-24T23:59:00.000Z");
	});

	it("keeps minute boundaries consistent for comparisons", () => {
		const a = floorToMinute(new Date("2026-04-24T10:30:05.000Z"));
		const b = floorToMinute(new Date("2026-04-24T10:30:55.000Z"));
		expect(a.getTime()).toBe(b.getTime());
	});
});
