import { describe, expect, it } from "vitest";
import {
	describeStaleness,
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/session-staleness";

const NOW = new Date("2026-06-01T12:00:00Z");

function minutesBefore(minutes: number): Date {
	return new Date(NOW.getTime() - minutes * 60_000);
}

describe("findLastStackUpdateAt", () => {
	it("picks the most recent stack update out of a mixed event list", () => {
		const result = findLastStackUpdateAt([
			{ eventType: "session_start", occurredAt: minutesBefore(180) },
			{ eventType: "update_stack", occurredAt: minutesBefore(90) },
			{ eventType: "memo", occurredAt: minutesBefore(10) },
			{ eventType: "update_stack", occurredAt: minutesBefore(30) },
			{ eventType: "chips_add_remove", occurredAt: minutesBefore(5) },
		]);
		expect(result).toEqual(minutesBefore(30));
	});

	it("ignores the order the events arrive in", () => {
		const result = findLastStackUpdateAt([
			{ eventType: "update_stack", occurredAt: minutesBefore(5) },
			{ eventType: "update_stack", occurredAt: minutesBefore(60) },
		]);
		expect(result).toEqual(minutesBefore(5));
	});

	it("is null when the session has no stack update yet", () => {
		expect(
			findLastStackUpdateAt([
				{ eventType: "session_start", occurredAt: minutesBefore(3) },
				{ eventType: "memo", occurredAt: minutesBefore(1) },
			])
		).toBeNull();
		expect(findLastStackUpdateAt([])).toBeNull();
	});

	it("accepts serialized timestamps", () => {
		expect(
			findLastStackUpdateAt([
				{ eventType: "update_stack", occurredAt: "2026-06-01T11:30:00Z" },
			])
		).toEqual(minutesBefore(30));
	});
});

describe("describeStaleness", () => {
	it("is null while no stack has ever been recorded", () => {
		expect(describeStaleness(null, NOW)).toBeNull();
	});

	it("stays fresh right up to the 20 minute threshold", () => {
		expect(describeStaleness(minutesBefore(0), NOW)).toEqual({
			level: "fresh",
			minutesAgo: 0,
		});
		expect(describeStaleness(minutesBefore(19), NOW)).toEqual({
			level: "fresh",
			minutesAgo: 19,
		});
	});

	it("turns stale at 20 minutes and stays so up to 45", () => {
		expect(describeStaleness(minutesBefore(20), NOW)?.level).toBe("stale");
		expect(describeStaleness(minutesBefore(44), NOW)?.level).toBe("stale");
	});

	it("turns critical at 45 minutes", () => {
		expect(describeStaleness(minutesBefore(45), NOW)).toEqual({
			level: "critical",
			minutesAgo: 45,
		});
		expect(describeStaleness(minutesBefore(300), NOW)?.level).toBe("critical");
	});

	it("clamps a clock skew into the future to zero minutes", () => {
		expect(describeStaleness(minutesBefore(-5), NOW)).toEqual({
			level: "fresh",
			minutesAgo: 0,
		});
	});
});
