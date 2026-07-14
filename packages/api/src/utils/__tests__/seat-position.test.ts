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
});
