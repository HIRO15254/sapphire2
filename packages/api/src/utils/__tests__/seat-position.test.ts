import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { assertSeatPositionFitsTableSize } from "../seat-position";

const OUTSIDE_TABLE_RE = /outside/;

describe("assertSeatPositionFitsTableSize", () => {
	it("accepts every 6-max seat boundary", () => {
		expect(() => assertSeatPositionFitsTableSize(0, 6)).not.toThrow();
		expect(() => assertSeatPositionFitsTableSize(5, 6)).not.toThrow();
	});

	it("rejects a seat outside the actual 6-max table", () => {
		expect(() => assertSeatPositionFitsTableSize(6, 6)).toThrow(TRPCError);
		expect(() => assertSeatPositionFitsTableSize(9, 6)).toThrow(
			OUTSIDE_TABLE_RE
		);
	});

	it("permits an omitted tableSize and a cleared seat", () => {
		expect(() => assertSeatPositionFitsTableSize(9, null)).not.toThrow();
		expect(() => assertSeatPositionFitsTableSize(null, 6)).not.toThrow();
		expect(() => assertSeatPositionFitsTableSize(undefined, 6)).not.toThrow();
	});

	it("rejects a non-positive tableSize defensively", () => {
		expect(() => assertSeatPositionFitsTableSize(0, 0)).toThrow(
			OUTSIDE_TABLE_RE
		);
	});

	it.each([
		[0, 1, true],
		[1, 1, false],
		[0, 2, true],
		[1, 2, true],
		[2, 2, false],
	])("validates seat %i fits tableSize %i", (seat, tableSize, shouldPass) => {
		const fn = () => assertSeatPositionFitsTableSize(seat, tableSize);
		if (shouldPass) {
			expect(fn).not.toThrow();
		} else {
			expect(fn).toThrow(TRPCError);
		}
	});
});
