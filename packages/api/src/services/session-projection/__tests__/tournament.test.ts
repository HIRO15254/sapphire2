import { describe, expect, it } from "vitest";
import {
	computeTournamentFromEvents,
	tournamentProjection,
} from "../tournament";
import { makeChainableDb, makeEvent } from "./test-utils";

describe("computeTournamentFromEvents — no session_end", () => {
	it("returns all nulls and beforeDeadline=false for empty events", () => {
		const result = computeTournamentFromEvents([]);
		expect(result.placement).toBeNull();
		expect(result.totalEntries).toBeNull();
		expect(result.prizeMoney).toBeNull();
		expect(result.bountyPrizes).toBeNull();
		expect(result.beforeDeadline).toBe(false);
	});

	it("returns all nulls when no session_end event exists", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_start", {}),
			makeEvent("purchase_chips", { chipPurchaseOptionId: "1" }),
		]);
		expect(result.prizeMoney).toBeNull();
		expect(result.placement).toBeNull();
	});
});

describe("computeTournamentFromEvents — beforeDeadline=false", () => {
	it("extracts placement, totalEntries, prizeMoney, bountyPrizes from session_end", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 3,
				totalEntries: 50,
				prizeMoney: 500,
				bountyPrizes: 75,
			}),
		]);
		expect(result.beforeDeadline).toBe(false);
		expect(result.placement).toBe(3);
		expect(result.totalEntries).toBe(50);
		expect(result.prizeMoney).toBe(500);
		expect(result.bountyPrizes).toBe(75);
	});

	it("handles placement=1 (winner)", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 1,
				totalEntries: 10,
				prizeMoney: 1000,
				bountyPrizes: 0,
			}),
		]);
		expect(result.placement).toBe(1);
		expect(result.bountyPrizes).toBe(0);
	});

	it("uses the last session_end event when multiple are present", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 5,
				totalEntries: 20,
				prizeMoney: 100,
				bountyPrizes: 0,
			}),
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 2,
				totalEntries: 20,
				prizeMoney: 300,
				bountyPrizes: 50,
			}),
		]);
		expect(result.placement).toBe(2);
		expect(result.prizeMoney).toBe(300);
	});
});

describe("computeTournamentFromEvents — beforeDeadline=true", () => {
	it("sets beforeDeadline=true and placement/totalEntries to null", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_end", {
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		]);
		expect(result.beforeDeadline).toBe(true);
		expect(result.placement).toBeNull();
		expect(result.totalEntries).toBeNull();
		expect(result.prizeMoney).toBe(0);
		expect(result.bountyPrizes).toBe(0);
	});

	it("handles non-zero prizeMoney with beforeDeadline=true", () => {
		const result = computeTournamentFromEvents([
			makeEvent("session_end", {
				beforeDeadline: true,
				prizeMoney: 200,
				bountyPrizes: 50,
			}),
		]);
		expect(result.prizeMoney).toBe(200);
		expect(result.bountyPrizes).toBe(50);
	});
});

describe("tournamentProjection — DB side effects", () => {
	it("updates existing session_tournament_detail row", async () => {
		const events = [
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 2,
				totalEntries: 30,
				prizeMoney: 800,
				bountyPrizes: 0,
			}),
		];
		const existingDetail = [{ sessionId: "session-1" }];
		const db = makeChainableDb([events, existingDetail]);

		await tournamentProjection(
			db as unknown as Parameters<typeof tournamentProjection>[0],
			"session-1"
		);

		expect(db.update).toHaveBeenCalledTimes(1);
		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				placement: 2,
				totalEntries: 30,
				prizeMoney: 800,
				bountyPrizes: 0,
				beforeDeadline: null,
			})
		);
	});

	it("sets beforeDeadline column to true (not null) when beforeDeadline=true", async () => {
		const events = [
			makeEvent("session_end", {
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		];
		const existingDetail = [{ sessionId: "session-1" }];
		const db = makeChainableDb([events, existingDetail]);

		await tournamentProjection(
			db as unknown as Parameters<typeof tournamentProjection>[0],
			"session-1"
		);

		expect(db._updateChain.set).toHaveBeenCalledWith(
			expect.objectContaining({
				beforeDeadline: true,
				placement: null,
				totalEntries: null,
			})
		);
	});

	it("does not update when no existing detail row", async () => {
		const events = [
			makeEvent("session_end", {
				beforeDeadline: false,
				placement: 1,
				totalEntries: 10,
				prizeMoney: 500,
				bountyPrizes: 0,
			}),
		];
		const db = makeChainableDb([events, []]);

		await tournamentProjection(
			db as unknown as Parameters<typeof tournamentProjection>[0],
			"session-1"
		);

		expect(db.update).not.toHaveBeenCalled();
	});
});
