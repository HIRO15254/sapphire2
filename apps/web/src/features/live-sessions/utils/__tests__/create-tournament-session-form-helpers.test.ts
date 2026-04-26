import { describe, expect, it } from "vitest";
import {
	createTournamentSessionFormSchema,
	parseTimerStartedAt,
} from "@/features/live-sessions/utils/create-tournament-session-form-helpers";

describe("parseTimerStartedAt", () => {
	it("returns undefined for empty string", () => {
		expect(parseTimerStartedAt("")).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(parseTimerStartedAt("   ")).toBeUndefined();
	});

	it("returns undefined for invalid date string", () => {
		expect(parseTimerStartedAt("not-a-date")).toBeUndefined();
	});

	it("returns unix seconds for valid ISO timestamp", () => {
		const iso = "2026-04-22T12:00:00.000Z";
		const expected = Math.floor(new Date(iso).getTime() / 1000);
		expect(parseTimerStartedAt(iso)).toBe(expected);
	});

	it("floors fractional milliseconds", () => {
		const iso = "2026-04-22T12:00:00.999Z";
		const expected = Math.floor(new Date(iso).getTime() / 1000);
		expect(parseTimerStartedAt(iso)).toBe(expected);
	});

	it("trims surrounding whitespace", () => {
		const iso = "2026-04-22T12:00:00.000Z";
		const expected = Math.floor(new Date(iso).getTime() / 1000);
		expect(parseTimerStartedAt(`  ${iso}  `)).toBe(expected);
	});
});

describe("createTournamentSessionFormSchema", () => {
	const valid = {
		buyIn: "100",
		entryFee: "10",
		startingStack: "20000",
		memo: "",
		timerStartedAt: "",
	};

	it("accepts a valid minimal payload", () => {
		expect(createTournamentSessionFormSchema.safeParse(valid).success).toBe(
			true
		);
	});

	it("accepts empty entryFee (optional)", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({ ...valid, entryFee: "" })
				.success
		).toBe(true);
	});

	it("rejects empty buyIn (required)", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({ ...valid, buyIn: "" })
				.success
		).toBe(false);
	});

	it("rejects empty startingStack (required)", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({
				...valid,
				startingStack: "",
			}).success
		).toBe(false);
	});

	it("rejects negative buyIn", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({ ...valid, buyIn: "-1" })
				.success
		).toBe(false);
	});

	it("rejects non-numeric buyIn", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({ ...valid, buyIn: "abc" })
				.success
		).toBe(false);
	});

	it("accepts zero startingStack (min: 0)", () => {
		expect(
			createTournamentSessionFormSchema.safeParse({
				...valid,
				startingStack: "0",
			}).success
		).toBe(true);
	});
});
