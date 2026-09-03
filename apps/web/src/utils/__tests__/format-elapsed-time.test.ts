import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatElapsedTime } from "../format-elapsed-time";

const NOW = new Date("2026-04-22T12:00:00Z");

describe("formatElapsedTime", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it.each([null, undefined])("returns em dash for %s", (value) => {
		expect(formatElapsedTime(value)).toBe("—");
	});

	it.each([
		["an unparseable string", "not-a-date"],
		["NaN", Number.NaN],
		["a future date", new Date(NOW.getTime() + 60_000)],
		["a future epoch number", NOW.getTime() + 60_000],
	])("returns em dash for %s", (_label, value) => {
		expect(formatElapsedTime(value)).toBe("—");
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
});
