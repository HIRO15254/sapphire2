import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatClockElapsed, formatElapsedTime } from "../format-elapsed-time";

const NOW = new Date("2026-04-22T12:00:00Z");

describe("formatElapsedTime", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns em dash for null", () => {
		expect(formatElapsedTime(null)).toBe("—");
	});

	it("returns em dash for undefined", () => {
		expect(formatElapsedTime(undefined)).toBe("—");
	});

	it("returns em dash for future dates", () => {
		const future = new Date(NOW.getTime() + 60_000);
		expect(formatElapsedTime(future)).toBe("—");
	});

	it("formats sub-hour elapsed as minutes only", () => {
		const past = new Date(NOW.getTime() - 30 * 60_000);
		expect(formatElapsedTime(past)).toBe("30m");
	});

	it("formats multi-hour elapsed as hours and minutes", () => {
		const past = new Date(NOW.getTime() - (90 * 60_000 + 45_000));
		expect(formatElapsedTime(past)).toBe("1h 30m");
	});

	it("accepts ISO string input", () => {
		const iso = new Date(NOW.getTime() - 15 * 60_000).toISOString();
		expect(formatElapsedTime(iso)).toBe("15m");
	});

	it("accepts number (epoch ms) input", () => {
		const epoch = NOW.getTime() - 60 * 60_000;
		expect(formatElapsedTime(epoch)).toBe("1h 0m");
	});

	it("returns '0m' when the timestamp is exactly now", () => {
		expect(formatElapsedTime(NOW)).toBe("0m");
	});

	it("returns '0m' for sub-minute elapsed time", () => {
		const past = new Date(NOW.getTime() - 59_000);
		expect(formatElapsedTime(past)).toBe("0m");
	});

	it("returns '0m' when elapsed is exactly one second (floored)", () => {
		const past = new Date(NOW.getTime() - 1000);
		expect(formatElapsedTime(past)).toBe("0m");
	});

	it("transitions from 'Xm' to 'Xh 0m' at exactly one hour", () => {
		const past = new Date(NOW.getTime() - 60 * 60_000);
		expect(formatElapsedTime(past)).toBe("1h 0m");
	});

	it("handles elapsed time larger than a day", () => {
		const past = new Date(NOW.getTime() - 25 * 60 * 60_000);
		expect(formatElapsedTime(past)).toBe("25h 0m");
	});

	it("returns em dash for unparseable string input (NaN diff)", () => {
		expect(formatElapsedTime("not-a-date")).toBe("—");
	});

	it("returns em dash for NaN numeric input", () => {
		expect(formatElapsedTime(Number.NaN)).toBe("—");
	});

	it("returns em dash for future epoch number input", () => {
		expect(formatElapsedTime(NOW.getTime() + 60_000)).toBe("—");
	});
});

describe("formatClockElapsed", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns em dash for null", () => {
		expect(formatClockElapsed(null)).toBe("—");
	});

	it("returns em dash for undefined", () => {
		expect(formatClockElapsed(undefined)).toBe("—");
	});

	it("returns em dash for NaN numeric input", () => {
		expect(formatClockElapsed(Number.NaN)).toBe("—");
	});

	it("returns em dash for future dates", () => {
		expect(formatClockElapsed(new Date(NOW.getTime() + 1000))).toBe("—");
	});

	it("formats zero elapsed as 00:00:00", () => {
		expect(formatClockElapsed(NOW)).toBe("00:00:00");
	});

	it("formats 59 seconds with zero-padded fields", () => {
		expect(formatClockElapsed(new Date(NOW.getTime() - 59_000))).toBe(
			"00:00:59"
		);
	});

	it("rolls seconds into minutes at 60s", () => {
		expect(formatClockElapsed(new Date(NOW.getTime() - 60_000))).toBe(
			"00:01:00"
		);
	});

	it("rolls minutes into hours at 3600s", () => {
		expect(formatClockElapsed(new Date(NOW.getTime() - 3_600_000))).toBe(
			"01:00:00"
		);
	});

	it("formats a mixed duration as HH:MM:SS", () => {
		const past = new Date(NOW.getTime() - (3 * 3600 + 2 * 60 + 15) * 1000);
		expect(formatClockElapsed(past)).toBe("03:02:15");
	});

	it("keeps counting past 24 hours without wrapping", () => {
		const past = new Date(NOW.getTime() - 26 * 3_600_000);
		expect(formatClockElapsed(past)).toBe("26:00:00");
	});

	it("accepts ISO string input", () => {
		expect(formatClockElapsed("2026-04-22T11:59:00Z")).toBe("00:01:00");
	});

	it("accepts epoch number input", () => {
		expect(formatClockElapsed(NOW.getTime() - 1000)).toBe("00:00:01");
	});
});
