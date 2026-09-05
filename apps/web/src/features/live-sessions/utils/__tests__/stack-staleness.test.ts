import { describe, expect, it } from "vitest";
import { stackStaleness } from "@/features/live-sessions/utils/stack-staleness";

const now = new Date("2026-08-26T12:00:00.000Z");

function minutesAgo(minutes: number): Date {
	return new Date(now.getTime() - minutes * 60_000);
}

describe("stackStaleness — invalid inputs", () => {
	it("returns muted dash for null", () => {
		expect(stackStaleness(null, now)).toEqual({
			agoText: "—",
			tone: "muted",
		});
	});

	it("returns muted dash for undefined", () => {
		expect(stackStaleness(undefined, now)).toEqual({
			agoText: "—",
			tone: "muted",
		});
	});

	it("returns muted dash for an unparseable date string", () => {
		expect(stackStaleness("not-a-date", now)).toEqual({
			agoText: "—",
			tone: "muted",
		});
	});

	it("returns muted dash for a NaN timestamp", () => {
		expect(stackStaleness(Number.NaN, now)).toEqual({
			agoText: "—",
			tone: "muted",
		});
	});

	it("clamps a future timestamp to 0m ago with muted tone", () => {
		const future = new Date(now.getTime() + 5 * 60_000);
		expect(stackStaleness(future, now)).toEqual({
			agoText: "0m ago",
			tone: "muted",
		});
	});
});

describe("stackStaleness — tone boundaries", () => {
	it("is muted at exactly 0 minutes", () => {
		expect(stackStaleness(now, now)).toEqual({
			agoText: "0m ago",
			tone: "muted",
		});
	});

	it("is muted at 19 minutes", () => {
		expect(stackStaleness(minutesAgo(19), now)).toEqual({
			agoText: "19m ago",
			tone: "muted",
		});
	});

	it("is warning at 20 minutes", () => {
		expect(stackStaleness(minutesAgo(20), now)).toEqual({
			agoText: "20m ago",
			tone: "warning",
		});
	});

	it("is warning at 44 minutes", () => {
		expect(stackStaleness(minutesAgo(44), now)).toEqual({
			agoText: "44m ago",
			tone: "warning",
		});
	});

	it("is destructive at 45 minutes", () => {
		expect(stackStaleness(minutesAgo(45), now)).toEqual({
			agoText: "45m ago",
			tone: "destructive",
		});
	});
});

describe("stackStaleness — agoText formatting", () => {
	it("formats 59 minutes as minutes-only", () => {
		expect(stackStaleness(minutesAgo(59), now)).toEqual({
			agoText: "59m ago",
			tone: "destructive",
		});
	});

	it("formats 60 minutes as hours and minutes", () => {
		expect(stackStaleness(minutesAgo(60), now)).toEqual({
			agoText: "1h 0m ago",
			tone: "destructive",
		});
	});

	it("formats 65 minutes as hours and minutes", () => {
		expect(stackStaleness(minutesAgo(65), now)).toEqual({
			agoText: "1h 5m ago",
			tone: "destructive",
		});
	});

	it("accepts an ISO string input", () => {
		expect(stackStaleness(minutesAgo(10).toISOString(), now)).toEqual({
			agoText: "10m ago",
			tone: "muted",
		});
	});

	it("accepts a numeric epoch-ms input", () => {
		expect(stackStaleness(minutesAgo(30).getTime(), now)).toEqual({
			agoText: "30m ago",
			tone: "warning",
		});
	});
});
