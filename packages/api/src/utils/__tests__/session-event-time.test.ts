import { describe, expect, it, vi } from "vitest";
import {
	floorToMinute,
	nextAppendSortOrder,
	resolveOccurredAt,
} from "../session-event-time";

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

function makeMaxSortOrderDb(rows: { maxSortOrder: number | null }[]) {
	const whereSpy = vi.fn().mockResolvedValue(rows);
	const fromSpy = vi.fn().mockReturnValue({ where: whereSpy });
	const selectSpy = vi.fn().mockReturnValue({ from: fromSpy });
	return {
		db: { select: selectSpy },
		whereSpy,
		fromSpy,
		selectSpy,
	};
}

describe("resolveOccurredAt", () => {
	it("returns floored client-supplied seconds when occurredAt is provided", () => {
		const now = new Date("2026-04-24T12:00:00.000Z");
		// 2026-04-24T10:30:42Z in unix seconds
		const supplied = Math.floor(
			new Date("2026-04-24T10:30:42.123Z").getTime() / 1000
		);
		const result = resolveOccurredAt(supplied, now);
		expect(result.toISOString()).toBe("2026-04-24T10:30:00.000Z");
	});

	it("falls back to floored now when occurredAt is undefined", () => {
		const now = new Date("2026-04-24T15:47:33.500Z");
		const result = resolveOccurredAt(undefined, now);
		expect(result.toISOString()).toBe("2026-04-24T15:47:00.000Z");
	});

	it("uses distinct now values for sequential events in different minutes", () => {
		// Regression: the previous implementation defaulted to sessionDate, so
		// every event created without an explicit occurredAt collapsed onto the
		// same timestamp. Each call must use the now passed in.
		const first = resolveOccurredAt(
			undefined,
			new Date("2026-04-24T18:00:10.000Z")
		);
		const second = resolveOccurredAt(
			undefined,
			new Date("2026-04-24T18:01:20.000Z")
		);
		const third = resolveOccurredAt(
			undefined,
			new Date("2026-04-24T18:02:30.000Z")
		);
		expect([
			first.toISOString(),
			second.toISOString(),
			third.toISOString(),
		]).toEqual([
			"2026-04-24T18:00:00.000Z",
			"2026-04-24T18:01:00.000Z",
			"2026-04-24T18:02:00.000Z",
		]);
	});

	it("does not collapse onto sessionDate when no occurredAt is supplied", () => {
		// The original bug: any default that ignored `now` made every event share
		// one timestamp. Guard against a regression by passing a sessionDate-like
		// value as `now` only when the caller actually wants it.
		const now = new Date("2026-04-24T22:15:00.000Z");
		const result = resolveOccurredAt(undefined, now);
		expect(result.getTime()).toBe(now.getTime());
	});

	it("treats occurredAt = 0 as a real epoch value, not as missing", () => {
		const now = new Date("2026-04-24T12:00:00.000Z");
		const result = resolveOccurredAt(0, now);
		expect(result.toISOString()).toBe("1970-01-01T00:00:00.000Z");
	});

	it("does not mutate the supplied now", () => {
		const now = new Date("2026-04-24T15:47:33.500Z");
		const original = now.getTime();
		resolveOccurredAt(undefined, now);
		expect(now.getTime()).toBe(original);
	});
});

describe("nextAppendSortOrder", () => {
	it("returns 0 when the session has no events", async () => {
		const { db } = makeMaxSortOrderDb([{ maxSortOrder: null }]);
		const result = await nextAppendSortOrder(
			db as unknown as Parameters<typeof nextAppendSortOrder>[0],
			"session-1"
		);
		expect(result).toBe(0);
	});

	it("returns 0 when select returns an empty array", async () => {
		const { db } = makeMaxSortOrderDb([]);
		const result = await nextAppendSortOrder(
			db as unknown as Parameters<typeof nextAppendSortOrder>[0],
			"session-1"
		);
		expect(result).toBe(0);
	});

	it("returns max(sortOrder) + 1 when events exist", async () => {
		const { db } = makeMaxSortOrderDb([{ maxSortOrder: 7 }]);
		const result = await nextAppendSortOrder(
			db as unknown as Parameters<typeof nextAppendSortOrder>[0],
			"session-1"
		);
		expect(result).toBe(8);
	});

	it("treats sortOrder = 0 as a real value (returns 1, not 0)", async () => {
		const { db } = makeMaxSortOrderDb([{ maxSortOrder: 0 }]);
		const result = await nextAppendSortOrder(
			db as unknown as Parameters<typeof nextAppendSortOrder>[0],
			"session-1"
		);
		expect(result).toBe(1);
	});

	it("calls select().from() exactly once and where() exactly once", async () => {
		const { db, fromSpy, whereSpy, selectSpy } = makeMaxSortOrderDb([
			{ maxSortOrder: 3 },
		]);
		await nextAppendSortOrder(
			db as unknown as Parameters<typeof nextAppendSortOrder>[0],
			"session-1"
		);
		expect(selectSpy).toHaveBeenCalledTimes(1);
		expect(fromSpy).toHaveBeenCalledTimes(1);
		expect(whereSpy).toHaveBeenCalledTimes(1);
	});
});
