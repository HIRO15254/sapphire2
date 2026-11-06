import { describe, expect, it } from "vitest";
import {
	foldTablePlayers,
	type TimedSeatEvent,
} from "../services/table-player-fold";

describe("foldTablePlayers", () => {
	const ev = (type: string, payload: Record<string, unknown>) => ({
		occurredAt: new Date(0),
		payload: JSON.stringify(payload),
		type,
	});

	const foldPlayerSeat = (events: TimedSeatEvent[], playerId: string) =>
		foldTablePlayers(events).find((item) => item.playerId === playerId)
			?.seatPosition ?? null;

	it("returns null when there are no matching joins", () => {
		expect(foldPlayerSeat([], "hero")).toBeNull();
		expect(
			foldPlayerSeat(
				[ev("player_join", { playerId: "other", seatPosition: 3 })],
				"hero"
			)
		).toBeNull();
	});

	it("folds a join, leave and rejoin for the requested player", () => {
		const join = ev("player_join", { playerId: "hero", seatPosition: 6 });
		const leave = ev("player_leave", { playerId: "hero" });
		expect(foldPlayerSeat([join], "hero")).toBe(6);
		expect(foldPlayerSeat([join, leave], "hero")).toBeNull();
		expect(
			foldPlayerSeat(
				[join, leave, ev("player_join", { playerId: "hero", seatPosition: 1 })],
				"hero"
			)
		).toBe(1);
	});

	it("preserves the seat on a join without a seat", () => {
		expect(
			foldPlayerSeat(
				[
					ev("player_join", { playerId: "hero", seatPosition: 6 }),
					ev("player_join", { playerId: "hero" }),
				],
				"hero"
			)
		).toBe(6);
	});

	it("stands the player up on a join with an explicit null seat", () => {
		expect(
			foldPlayerSeat(
				[
					ev("player_join", { playerId: "hero", seatPosition: 6 }),
					ev("player_join", { playerId: "hero", seatPosition: null }),
					ev("player_join", { playerId: "hero" }),
				],
				"hero"
			)
		).toBeNull();
	});

	it("ignores other players and unrelated event types", () => {
		expect(
			foldPlayerSeat(
				[
					ev("player_join", { playerId: "hero", seatPosition: 6 }),
					ev("player_join", { playerId: "other", seatPosition: 2 }),
					ev("player_leave", { playerId: "other" }),
					ev("memo", { playerId: "hero" }),
				],
				"hero"
			)
		).toBe(6);
	});

	it("skips schema-invalid join and leave payloads", () => {
		expect(
			foldPlayerSeat(
				[
					ev("player_join", { playerId: "hero", seatPosition: 6 }),
					ev("player_join", { playerId: "hero", seatPosition: "invalid" }),
					ev("player_leave", { playerId: "" }),
				],
				"hero"
			)
		).toBe(6);
	});
});
