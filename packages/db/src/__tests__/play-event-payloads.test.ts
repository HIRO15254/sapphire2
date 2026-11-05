import { describe, expect, it } from "vitest";
import type { EntryKind } from "../constants/entry";
import { playEventPayloadSchema } from "../constants/play-event-payloads";

function accepts(kind: EntryKind, type: string, payload: unknown): boolean {
	return (
		playEventPayloadSchema(kind, type)?.safeParse(payload).success ?? false
	);
}

describe("play event payload v2 registry", () => {
	it.each([
		["tournament", "all_in"],
		["tournament", "chips_add_remove"],
		["cash", "purchase_chips"],
		["cash", "reentry"],
		["cash", "table_change"],
	] as const)("has no %s %s payload", (kind, type) => {
		expect(playEventPayloadSchema(kind, type)).toBeNull();
	});

	it("names every player by id, so a Hero-flag event is rejected", () => {
		expect(
			accepts("cash", "player_join", { isHero: true, seatPosition: 3 })
		).toBe(false);
		expect(accepts("cash", "player_leave", { isHero: true })).toBe(false);
		expect(
			accepts("cash", "player_join", { playerId: "self", seatPosition: 9 })
		).toBe(true);
		expect(
			accepts("cash", "player_join", { playerId: "self", seatPosition: 10 })
		).toBe(false);
	});

	it("rejects an all-in with more wins than trials (SA2-156)", () => {
		const allIn = { potSize: 1000, trials: 2, equity: 50 };
		expect(accepts("cash", "all_in", { ...allIn, wins: 2 })).toBe(true);
		expect(accepts("cash", "all_in", { ...allIn, wins: 2.5 })).toBe(false);
	});

	it("rejects a tournament finish placed below the field", () => {
		const end = { beforeDeadline: false, totalEntries: 10, payments: [] };
		expect(
			accepts("tournament", "session_end", { ...end, placement: 10 })
		).toBe(true);
		expect(
			accepts("tournament", "session_end", { ...end, placement: 11 })
		).toBe(false);
	});

	it("rejects a chip add/remove that moves nothing or names no asset", () => {
		expect(
			accepts("cash", "chips_add_remove", { amount: -20, assetId: "jpy" })
		).toBe(true);
		expect(
			accepts("cash", "chips_add_remove", { amount: 0, assetId: "jpy" })
		).toBe(false);
		expect(accepts("cash", "chips_add_remove", { amount: 20 })).toBe(false);
	});
});
