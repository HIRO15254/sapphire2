import { expect, it } from "vitest";
import { chunkForInsert } from "../lib/batch";

it("never emits an insert chunk wider than D1 permits", () => {
	const rows = Array.from({ length: 21 }, (_, index) => index);
	expect(chunkForInsert(rows, 10).map((chunk) => chunk.length)).toEqual([
		10, 10, 1,
	]);
});
