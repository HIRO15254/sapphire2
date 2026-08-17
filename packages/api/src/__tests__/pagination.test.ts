import { describe, expect, it } from "vitest";
import { paginate } from "../routers/_pagination";

interface Row {
	id: string;
}
const makeRows = (n: number): Row[] =>
	Array.from({ length: n }, (_, i) => ({ id: `tx-${i + 1}` }));

describe("paginate", () => {
	it("returns no items and no nextCursor when rows is empty", () => {
		expect(paginate([], 10)).toEqual({ items: [], nextCursor: undefined });
	});

	it("returns all rows and no nextCursor when rows.length < pageSize", () => {
		const rows = makeRows(9);
		expect(paginate(rows, 10)).toEqual({ items: rows, nextCursor: undefined });
	});

	it("returns all rows and no nextCursor at the exact pageSize boundary (rows.length === pageSize)", () => {
		const rows = makeRows(10);
		expect(paginate(rows, 10)).toEqual({ items: rows, nextCursor: undefined });
	});

	it("clamps to pageSize and exposes nextCursor when rows.length === pageSize + 1 (the canonical 'has more' fetch)", () => {
		const rows = makeRows(11);
		const result = paginate(rows, 10);
		expect(result.items).toHaveLength(10);
		expect(result.items).toEqual(rows.slice(0, 10));
		expect(result.nextCursor).toBe("tx-10");
	});

	it("clamps and uses the last returned id when the caller over-fetches beyond pageSize + 1", () => {
		const rows = makeRows(25);
		const result = paginate(rows, 10);
		expect(result.items).toHaveLength(10);
		expect(result.nextCursor).toBe("tx-10");
	});

	it("works with a pageSize of 1 (degenerate but supported)", () => {
		expect(paginate(makeRows(1), 1)).toEqual({
			items: [{ id: "tx-1" }],
			nextCursor: undefined,
		});
		expect(paginate(makeRows(2), 1)).toEqual({
			items: [{ id: "tx-1" }],
			nextCursor: "tx-1",
		});
	});

	it("does not mutate the input array", () => {
		const rows = makeRows(11);
		const before = [...rows];
		paginate(rows, 10);
		expect(rows).toEqual(before);
	});
});
