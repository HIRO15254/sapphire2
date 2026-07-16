import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import {
	assertAppendOccurredAtOrdering,
	floorToMinute,
	latestSessionEventOrderBy,
	nextAppendSortOrderSql,
	resolveOccurredAt,
	sessionEventOrderBy,
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

function makeLatestEventDb(rows: { occurredAt: Date }[]) {
	const limit = vi.fn().mockResolvedValue(rows);
	const orderBy = vi.fn().mockReturnValue({ limit });
	const where = vi.fn().mockReturnValue({ orderBy });
	const from = vi.fn().mockReturnValue({ where });
	const select = vi.fn().mockReturnValue({ from });
	return { db: { select }, from, limit, orderBy, select, where };
}

describe("assertAppendOccurredAtOrdering", () => {
	it("allows the first event and performs one latest-event lookup", async () => {
		const chain = makeLatestEventDb([]);
		await expect(
			assertAppendOccurredAtOrdering(
				chain.db as unknown as Parameters<
					typeof assertAppendOccurredAtOrdering
				>[0],
				"session-1",
				new Date("2026-01-01T10:30:00.000Z")
			)
		).resolves.toBeUndefined();
		expect(chain.select).toHaveBeenCalledTimes(1);
		expect(chain.from).toHaveBeenCalledTimes(1);
		expect(chain.where).toHaveBeenCalledTimes(1);
		expect(chain.orderBy).toHaveBeenCalledTimes(1);
		expect(chain.limit).toHaveBeenCalledTimes(1);
	});

	it("allows an append in the same minute as the latest event", async () => {
		const chain = makeLatestEventDb([
			{ occurredAt: new Date("2026-01-01T10:30:00.000Z") },
		]);
		await expect(
			assertAppendOccurredAtOrdering(
				chain.db as unknown as Parameters<
					typeof assertAppendOccurredAtOrdering
				>[0],
				"session-1",
				new Date("2026-01-01T10:30:00.000Z")
			)
		).resolves.toBeUndefined();
	});

	it("allows an append after the latest event", async () => {
		const chain = makeLatestEventDb([
			{ occurredAt: new Date("2026-01-01T10:29:00.000Z") },
		]);
		await expect(
			assertAppendOccurredAtOrdering(
				chain.db as unknown as Parameters<
					typeof assertAppendOccurredAtOrdering
				>[0],
				"session-1",
				new Date("2026-01-01T10:30:00.000Z")
			)
		).resolves.toBeUndefined();
	});

	it("rejects an append before the latest event minute", async () => {
		const chain = makeLatestEventDb([
			{ occurredAt: new Date("2026-01-01T10:31:00.000Z") },
		]);
		await expect(
			assertAppendOccurredAtOrdering(
				chain.db as unknown as Parameters<
					typeof assertAppendOccurredAtOrdering
				>[0],
				"session-1",
				new Date("2026-01-01T10:30:00.000Z")
			)
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message:
				"occurredAt would precede the previous event by minute; reorder via sortOrder instead",
		});
	});
});
describe("nextAppendSortOrderSql", () => {
	const dialect = new SQLiteSyncDialect();

	it("computes max plus one inside the INSERT statement", () => {
		const query = dialect.sqlToQuery(nextAppendSortOrderSql("session-1"));
		const normalizedSql = query.sql.toLowerCase();
		expect(normalizedSql).toContain("coalesce(max(");
		expect(normalizedSql).toContain('from "session_event"');
		expect(normalizedSql).toContain('where "session_event"."session_id" = ?');
		expect(normalizedSql).toContain("+ 1");
		expect(query.params).toEqual(["session-1"]);
	});
});

describe("sessionEventOrderBy", () => {
	it("uses occurredAt, sortOrder, and id as the shared stable order", () => {
		const dialect = new SQLiteSyncDialect();
		const sqlParts = sessionEventOrderBy().map(
			(order) => dialect.sqlToQuery(order).sql
		);
		expect(sqlParts).toEqual([
			'"session_event"."occurred_at" asc',
			'"session_event"."sort_order" asc',
			'"session_event"."id" asc',
		]);
	});
});

describe("latestSessionEventOrderBy", () => {
	it("uses occurredAt, sortOrder, and id descending to select the latest event", () => {
		const dialect = new SQLiteSyncDialect();
		const sqlParts = latestSessionEventOrderBy().map(
			(order) => dialect.sqlToQuery(order).sql
		);
		expect(sqlParts).toEqual([
			'"session_event"."occurred_at" desc',
			'"session_event"."sort_order" desc',
			'"session_event"."id" desc',
		]);
	});
});
