import { describe, expect, it } from "vitest";
import { TZ_EAST, TZ_WEST, withTz } from "@/__tests__/tz";
import { formatDateForInput } from "@/features/sessions/utils/session-form-helpers";

describe("formatDateForInput across time zones", () => {
	it("renders the UTC calendar day west of UTC, where the local day is still yesterday", () => {
		expect(
			withTz(TZ_WEST, () => formatDateForInput("2026-04-11T00:00:00.000Z"))
		).toBe("2026-04-11");
	});

	it("renders the UTC calendar day east of UTC, where the local day is already tomorrow", () => {
		expect(
			withTz(TZ_EAST, () => formatDateForInput("2026-04-10T23:30:00.000Z"))
		).toBe("2026-04-10");
	});

	it("zero-pads a single-digit month and day", () => {
		expect(
			withTz(TZ_WEST, () => formatDateForInput("2026-01-05T12:00:00.000Z"))
		).toBe("2026-01-05");
	});
});
