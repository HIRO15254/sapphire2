import { constantTimeEqual } from "@sapphire2/auth";
import { describe, expect, it } from "vitest";

describe("constantTimeEqual", () => {
	it("accepts equal byte arrays", () => {
		expect(
			constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))
		).toBe(true);
	});

	it("rejects a mismatch at either boundary", () => {
		expect(
			constantTimeEqual(new Uint8Array([0, 2]), new Uint8Array([1, 2]))
		).toBe(false);
		expect(
			constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 0]))
		).toBe(false);
	});

	it("rejects a different length including an empty array", () => {
		expect(constantTimeEqual(new Uint8Array(), new Uint8Array([1]))).toBe(
			false
		);
		expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(
			false
		);
	});
});
