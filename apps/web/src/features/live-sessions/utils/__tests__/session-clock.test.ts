import { describe, expect, it } from "vitest";
import { computeSessionClock } from "@/features/live-sessions/utils/session-clock";

const START = new Date("2026-06-01T10:00:00Z");

function at(minutes: number): Date {
	return new Date(START.getTime() + minutes * 60_000);
}

function event(eventType: string, minutes: number) {
	return { eventType, occurredAt: at(minutes) };
}

describe("computeSessionClock", () => {
	it("counts the time since the session started while it runs", () => {
		const clock = computeSessionClock([event("session_start", 0)], at(90));
		expect(clock.activeSeconds).toBe(90 * 60);
		expect(clock.pausedSeconds).toBe(0);
	});

	it("stops counting session time while paused", () => {
		const clock = computeSessionClock(
			[event("session_start", 0), event("session_pause", 30)],
			at(90)
		);
		expect(clock.activeSeconds).toBe(30 * 60);
	});

	it("counts the pause itself up from the moment it started", () => {
		const clock = computeSessionClock(
			[event("session_start", 0), event("session_pause", 30)],
			at(90)
		);
		expect(clock.pausedSeconds).toBe(60 * 60);
	});

	it("excludes every paused span from the session time", () => {
		const clock = computeSessionClock(
			[
				event("session_start", 0),
				event("session_pause", 20),
				event("session_resume", 50),
				event("session_pause", 60),
				event("session_resume", 100),
			],
			at(110)
		);
		expect(clock.activeSeconds).toBe((20 + 10 + 10) * 60);
		expect(clock.pausedSeconds).toBe(0);
	});

	it("freezes the session time once the session ends", () => {
		const clock = computeSessionClock(
			[event("session_start", 0), event("session_end", 45)],
			at(200)
		);
		expect(clock.activeSeconds).toBe(45 * 60);
		expect(clock.pausedSeconds).toBe(0);
	});

	it("ignores events unrelated to the clock", () => {
		const clock = computeSessionClock(
			[
				event("session_start", 0),
				event("update_stack", 10),
				event("memo", 20),
				event("all_in", 25),
			],
			at(30)
		);
		expect(clock.activeSeconds).toBe(30 * 60);
	});

	it("does not depend on the order the events arrive in", () => {
		const clock = computeSessionClock(
			[
				event("session_resume", 50),
				event("session_start", 0),
				event("session_pause", 20),
			],
			at(60)
		);
		expect(clock.activeSeconds).toBe((20 + 10) * 60);
	});

	it("is zero before a session has started", () => {
		expect(computeSessionClock([], at(30))).toEqual({
			activeSeconds: 0,
			pausedSeconds: 0,
			pausedSinceMs: null,
		});
	});

	it("ignores a repeated pause while already paused", () => {
		const clock = computeSessionClock(
			[
				event("session_start", 0),
				event("session_pause", 20),
				event("session_pause", 40),
			],
			at(60)
		);
		expect(clock.activeSeconds).toBe(20 * 60);
		expect(clock.pausedSeconds).toBe(40 * 60);
	});

	it("reports the instant the current pause began so a blind timer can be shifted by it", () => {
		const clock = computeSessionClock(
			[event("session_start", 0), event("session_pause", 30)],
			at(90)
		);
		expect(clock.pausedSinceMs).toBe(at(30).getTime());
	});

	it("has no pause instant once the session resumes", () => {
		const clock = computeSessionClock(
			[
				event("session_start", 0),
				event("session_pause", 30),
				event("session_resume", 50),
			],
			at(90)
		);
		expect(clock.pausedSinceMs).toBeNull();
	});

	it("clamps a clock skew into the future to zero", () => {
		const clock = computeSessionClock([event("session_start", 10)], at(0));
		expect(clock.activeSeconds).toBe(0);
	});

	it("accepts serialized timestamps", () => {
		const clock = computeSessionClock(
			[{ eventType: "session_start", occurredAt: START.toISOString() }],
			at(15)
		);
		expect(clock.activeSeconds).toBe(15 * 60);
	});
});
