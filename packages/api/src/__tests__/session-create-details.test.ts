import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { describe, expect, it } from "vitest";
import { resolveCashRuleSnapshot } from "../routers/session";
import { createCaller } from "./caller";
import { createChainableMockDb } from "./test-utils";

const CALLER = "user-1";
const OTHER = "user-2";

function makeCaller(select: Record<string, Record<string, unknown>[]> = {}) {
	return createCaller({ select, userId: CALLER });
}

describe("session.create converts epoch-second startedAt/endedAt into Dates (timestampToDate)", () => {
	it("stores startedAt and endedAt as Date objects on the inserted session", async () => {
		const { caller, inserted } = makeCaller();

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 100,
			cashOut: 200,
			startedAt: 1_700_000_000,
			endedAt: 1_700_003_600,
		});

		expect(inserted.game_session?.[0]).toMatchObject({
			startedAt: new Date(1_700_000_000 * 1000),
			endedAt: new Date(1_700_003_600 * 1000),
		});
	});
});

describe("session.create room ownership (validateCreateLinks)", () => {
	it("creates the session when roomId is owned by the caller", async () => {
		const { caller, inserted } = makeCaller({
			room: [{ id: "room-1", userId: CALLER }],
		});

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 100,
			cashOut: 200,
			roomId: "room-1",
		});

		expect(inserted.game_session?.[0]).toMatchObject({ roomId: "room-1" });
	});

	it("rejects a foreign roomId with FORBIDDEN before writing anything", async () => {
		const { caller, inserted } = makeCaller({
			room: [{ id: "room-1", userId: OTHER }],
		});

		await expect(
			caller.session.create({
				type: "cash_game",
				sessionDate: 1_700_000_000,
				buyIn: 100,
				cashOut: 200,
				roomId: "room-1",
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(inserted.game_session).toBeUndefined();
	});
});

describe("resolveCashRuleSnapshot falls back to the default snapshot for an unresolved ringGameId", () => {
	it("returns the default rule name, variant, and null blinds/limits when the ring game does not exist", async () => {
		const db = createChainableMockDb({ select: { ring_game: [] } });

		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "missing",
		});

		expect(snapshot).toEqual({
			ruleName: "Untitled",
			variant: DEFAULT_VARIANT_LABEL,
			mixGames: null,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: null,
		});
	});
});

describe("session.create tournament beforeDeadline clears placement/totalEntries", () => {
	it("nulls placement and totalEntries even when both are provided alongside beforeDeadline: true", async () => {
		const { caller, inserted } = makeCaller();

		await caller.session.create({
			type: "tournament",
			sessionDate: 1_700_000_000,
			tournamentBuyIn: 100,
			entryFee: 0,
			beforeDeadline: true,
			placement: 5,
			totalEntries: 10,
		});

		expect(inserted.session_tournament_detail?.[0]).toMatchObject({
			beforeDeadline: true,
			placement: null,
			totalEntries: null,
		});
	});
});

describe("session.create persists blindLevels rows", () => {
	it("inserts one session_blind_level row per provided level, in order", async () => {
		const { caller, inserted } = makeCaller();

		await caller.session.create({
			type: "tournament",
			sessionDate: 1_700_000_000,
			tournamentBuyIn: 100,
			entryFee: 0,
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 },
				{ isBreak: true, minutes: 10 },
			],
		});

		expect(inserted.session_blind_level?.[0]).toEqual([
			expect.objectContaining({
				level: 1,
				isBreak: false,
				blind1: 100,
				blind2: 200,
				minutes: 20,
			}),
			expect.objectContaining({ level: 2, isBreak: true, minutes: 10 }),
		]);
	});
});
