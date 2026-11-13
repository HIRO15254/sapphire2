import { describe, expect, it } from "vitest";
import { parseQuantity, quantityToInput } from "../amount";
import { parseRate, rateValue } from "../rate";

describe("parseQuantity", () => {
	it("stores a decimal amount in the asset's smallest unit", () => {
		expect(parseQuantity("1,234.5", 2)).toEqual({ ok: true, value: 123_450 });
		expect(parseQuantity("7", 0)).toEqual({ ok: true, value: 7 });
	});

	it("rejects more decimal places than the asset keeps instead of rounding", () => {
		expect(parseQuantity("1.234", 2)).toEqual({
			error: "Up to 2 decimal places",
			ok: false,
		});
		expect(parseQuantity("0.5", 0)).toEqual({
			error: "Whole numbers only",
			ok: false,
		});
	});

	it("round-trips an edited amount back to the same quantity", () => {
		expect(parseQuantity(quantityToInput(-123_450, 2), 2)).toEqual({
			ok: true,
			value: 123_450,
		});
	});
});

describe("parseRate", () => {
	it("expresses the rate in smallest units of both assets", () => {
		const parsed = parseRate("0.12", 0, 2);
		expect(parsed).toEqual({ ok: true, value: { rateDen: 1, rateNum: 12 } });
		if (parsed.ok) {
			expect(rateValue(parsed.value, 0, 2)).toBeCloseTo(0.12);
		}
	});

	it("keeps the human value when the base asset has decimals", () => {
		const parsed = parseRate("150", 2, 0);
		expect(parsed).toEqual({ ok: true, value: { rateDen: 2, rateNum: 3 } });
		if (parsed.ok) {
			expect(rateValue(parsed.value, 2, 0)).toBe(150);
		}
	});
});
