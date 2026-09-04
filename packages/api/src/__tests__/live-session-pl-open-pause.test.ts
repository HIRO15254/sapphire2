import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeBreakMinutesFromEvents } from "../services/live-session-pl";

describe("computeBreakMinutesFromEvents with an open pause", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("counts the break up to now when the session is still paused", () => {
		const now = new Date("2024-01-01T12:00:00Z");
		vi.setSystemTime(now);
		const events = [
			{
				eventType: "session_pause",
				occurredAt: new Date(now.getTime() - 10 * 60 * 1000),
			},
		];

		expect(computeBreakMinutesFromEvents(events)).toBe(10);
	});
});
