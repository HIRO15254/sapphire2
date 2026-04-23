import { describe, expect, it } from "vitest";
import type { SessionFilterValues } from "@/features/sessions/components/session-filters";
import { countActiveFilters } from "@/features/sessions/utils/session-filters-helpers";

function filters(
	overrides: Partial<SessionFilterValues> = {}
): SessionFilterValues {
	return {
		type: undefined,
		storeId: undefined,
		currencyId: undefined,
		dateFrom: undefined,
		dateTo: undefined,
		...overrides,
	} as SessionFilterValues;
}

describe("countActiveFilters", () => {
	it("returns 0 for an empty filter object", () => {
		expect(countActiveFilters(filters())).toBe(0);
	});

	it("counts each present field individually", () => {
		expect(countActiveFilters(filters({ type: "cash_game" }))).toBe(1);
		expect(countActiveFilters(filters({ storeId: "store-1" }))).toBe(1);
		expect(countActiveFilters(filters({ currencyId: "jpy" }))).toBe(1);
		expect(countActiveFilters(filters({ dateFrom: "2026-01-01" }))).toBe(1);
		expect(countActiveFilters(filters({ dateTo: "2026-02-01" }))).toBe(1);
	});

	it("returns 5 when every field is set", () => {
		expect(
			countActiveFilters(
				filters({
					type: "tournament",
					storeId: "store-1",
					currencyId: "usd",
					dateFrom: "2026-01-01",
					dateTo: "2026-02-01",
				})
			)
		).toBe(5);
	});

	it("does not count empty strings as active", () => {
		expect(
			countActiveFilters(
				filters({
					type: "" as unknown as SessionFilterValues["type"],
					storeId: "",
					currencyId: "",
					dateFrom: "",
					dateTo: "",
				})
			)
		).toBe(0);
	});
});
