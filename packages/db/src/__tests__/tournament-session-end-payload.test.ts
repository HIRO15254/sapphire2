import { describe, expect, it } from "vitest";
import { tournamentSessionEndPayload } from "../constants/session-event-types";

describe("tournamentSessionEndPayload placement integrity", () => {
	const base = {
		beforeDeadline: false,
		prizeMoney: 0,
		bountyPrizes: 0,
	} as const;

	it("rejects placement greater than totalEntries", () => {
		expect(() =>
			tournamentSessionEndPayload.parse({
				...base,
				placement: 11,
				totalEntries: 10,
			})
		).toThrow("Placement must be less than or equal to total entries");
	});

	it("accepts placement equal to totalEntries and the one-player boundary", () => {
		expect(
			tournamentSessionEndPayload.parse({
				...base,
				placement: 10,
				totalEntries: 10,
			})
		).toMatchObject({ placement: 10, totalEntries: 10 });
		expect(
			tournamentSessionEndPayload.parse({
				...base,
				placement: 1,
				totalEntries: 1,
			})
		).toMatchObject({ placement: 1, totalEntries: 1 });
	});
});
