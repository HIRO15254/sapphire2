import { describe, expect, it } from "vitest";
import {
	computeCurrentPlayers,
	computeCurrentPlayersFromEvents,
} from "../current-players";
import { makeChainableDb, makeEvent } from "./test-utils";

const t = (iso: string) => new Date(iso);

describe("computeCurrentPlayersFromEvents — empty and no-op events", () => {
	it("returns empty array for empty events", () => {
		expect(computeCurrentPlayersFromEvents([])).toEqual([]);
	});

	it("returns empty array when no player_join or player_leave events", () => {
		const events = [
			{
				...makeEvent("session_start", {}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("memo", { text: "hi" }),
				occurredAt: t("2024-01-01T10:01:00Z"),
			},
		];
		expect(computeCurrentPlayersFromEvents(events)).toEqual([]);
	});
});

describe("computeCurrentPlayersFromEvents — single player", () => {
	it("includes player after player_join", () => {
		const joinedAt = t("2024-01-01T10:00:00Z");
		const events = [
			{
				...makeEvent("player_join", { playerId: "p1", isHero: false }),
				occurredAt: joinedAt,
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(1);
		expect(result[0]?.playerId).toBe("p1");
		expect(result[0]?.isHero).toBe(false);
		expect(result[0]?.joinedAt).toEqual(joinedAt);
	});

	it("excludes player after player_join then player_leave", () => {
		const events = [
			{
				...makeEvent("player_join", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_leave", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
		];
		expect(computeCurrentPlayersFromEvents(events)).toHaveLength(0);
	});

	it("includes player again after leave then rejoin (re-entry)", () => {
		const secondJoinAt = t("2024-01-01T12:00:00Z");
		const events = [
			{
				...makeEvent("player_join", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_leave", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
			{
				...makeEvent("player_join", { playerId: "p1", isHero: false }),
				occurredAt: secondJoinAt,
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(1);
		expect(result[0]?.playerId).toBe("p1");
		expect(result[0]?.joinedAt).toEqual(secondJoinAt);
	});
});

describe("computeCurrentPlayersFromEvents — Hero", () => {
	it("tracks Hero by isHero flag, playerId is undefined", () => {
		const joinedAt = t("2024-01-01T10:00:00Z");
		const events = [
			{
				...makeEvent("player_join", { isHero: true, seatPosition: 3 }),
				occurredAt: joinedAt,
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(1);
		expect(result[0]?.isHero).toBe(true);
		expect(result[0]?.playerId).toBeUndefined();
		expect(result[0]?.seatPosition).toBe(3);
		expect(result[0]?.joinedAt).toEqual(joinedAt);
	});

	it("removes Hero after player_leave with isHero=true", () => {
		const events = [
			{
				...makeEvent("player_join", { isHero: true }),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_leave", { isHero: true }),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
		];
		expect(computeCurrentPlayersFromEvents(events)).toHaveLength(0);
	});

	it("handles Hero and regular players simultaneously", () => {
		const events = [
			{
				...makeEvent("player_join", { isHero: true, seatPosition: 1 }),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_join", {
					playerId: "p1",
					isHero: false,
					seatPosition: 2,
				}),
				occurredAt: t("2024-01-01T10:01:00Z"),
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(2);
		const hero = result.find((p) => p.isHero);
		const regular = result.find((p) => !p.isHero);
		expect(hero?.seatPosition).toBe(1);
		expect(regular?.playerId).toBe("p1");
	});
});

describe("computeCurrentPlayersFromEvents — seat move (leave then join)", () => {
	it("updates seatPosition after leave-join sequence", () => {
		const events = [
			{
				...makeEvent("player_join", {
					playerId: "p1",
					isHero: false,
					seatPosition: 2,
				}),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_leave", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T10:10:00Z"),
			},
			{
				...makeEvent("player_join", {
					playerId: "p1",
					isHero: false,
					seatPosition: 5,
				}),
				occurredAt: t("2024-01-01T10:11:00Z"),
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(1);
		expect(result[0]?.seatPosition).toBe(5);
	});
});

describe("computeCurrentPlayersFromEvents — multiple players", () => {
	it("tracks multiple players independently", () => {
		const events = [
			{
				...makeEvent("player_join", { playerId: "p1", isHero: false }),
				occurredAt: t("2024-01-01T10:00:00Z"),
			},
			{
				...makeEvent("player_join", { playerId: "p2", isHero: false }),
				occurredAt: t("2024-01-01T10:01:00Z"),
			},
			{
				...makeEvent("player_join", { playerId: "p3", isHero: false }),
				occurredAt: t("2024-01-01T10:02:00Z"),
			},
			{
				...makeEvent("player_leave", { playerId: "p2", isHero: false }),
				occurredAt: t("2024-01-01T11:00:00Z"),
			},
		];
		const result = computeCurrentPlayersFromEvents(events);
		expect(result).toHaveLength(2);
		const ids = result.map((p) => p.playerId);
		expect(ids).toContain("p1");
		expect(ids).toContain("p3");
		expect(ids).not.toContain("p2");
	});
});

describe("computeCurrentPlayersFromEvents — invalid payloads", () => {
	it("skips player_join events with invalid payload", () => {
		const badEvent = {
			...makeEvent("player_join", {}),
			payload: "not-json-at-all",
			occurredAt: t("2024-01-01T10:00:00Z"),
		};
		expect(() => computeCurrentPlayersFromEvents([badEvent])).not.toThrow();
	});
});

describe("computeCurrentPlayers — async DB wrapper", () => {
	it("returns players computed from events fetched from DB", async () => {
		const joinedAt = t("2024-01-01T10:00:00Z");
		const events = [
			{
				eventType: "player_join",
				payload: JSON.stringify({ playerId: "p1", isHero: false }),
				occurredAt: joinedAt,
				sortOrder: 0,
			},
		];
		const db = makeChainableDb([events]);

		const result = await computeCurrentPlayers(
			db as unknown as Parameters<typeof computeCurrentPlayers>[0],
			"session-1"
		);

		expect(result).toHaveLength(1);
		expect(result[0]?.playerId).toBe("p1");
	});

	it("returns empty array when no events in DB", async () => {
		const db = makeChainableDb([[]]);
		const result = await computeCurrentPlayers(
			db as unknown as Parameters<typeof computeCurrentPlayers>[0],
			"session-1"
		);
		expect(result).toEqual([]);
	});
});
