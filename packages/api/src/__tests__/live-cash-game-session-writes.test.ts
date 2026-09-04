import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createCaller } from "./caller";
import { boundParams } from "./test-utils";

const OWNER = "user-1";

const ownedSession = {
	id: "s1",
	userId: OWNER,
	kind: "cash_game",
	status: "active",
	source: "live",
	roomId: null,
	currencyId: null,
};

describe("liveCashGameSession.update resolves the ring game's room and currency onto the session", () => {
	it("adopts the owned ring game's roomId and currencyId when the session has neither", async () => {
		const { caller, updated } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [ownedSession],
				session_cash_detail: [],
				ring_game: [
					{
						id: "rg-1",
						userId: OWNER,
						roomId: "room-1",
						currencyId: "cur-1",
						name: "1/2 NLH",
						variant: "NL Hold'em",
						mixGames: null,
						blind1: 1,
						blind2: 2,
						blind3: null,
						ante: null,
						anteType: null,
						minBuyIn: null,
						maxBuyIn: null,
						tableSize: 9,
					},
				],
			},
		});

		await caller.liveCashGameSession.update({ id: "s1", ringGameId: "rg-1" });

		expect(updated.game_session?.[0]).toMatchObject({
			roomId: "room-1",
			currencyId: "cur-1",
		});
	});
});

describe("liveCashGameSession.update recalculation on a completed session", () => {
	it("recalculates and upserts the currency_transaction when currencyId changes on a completed session", async () => {
		const startedAt = new Date("2026-08-01T10:00:00.000Z");
		const { caller, inserted } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [
					{
						...ownedSession,
						status: "completed",
						currencyId: "c2",
						startedAt,
						sessionDate: startedAt,
						breakMinutes: null,
					},
				],
				session_cash_detail: [
					{
						sessionId: "s1",
						ringGameId: null,
						variant: "NL Hold'em",
						ruleName: "Cash Game",
						mixGames: null,
					},
				],
				session_event: [
					{
						id: "e1",
						sessionId: "s1",
						eventType: "session_start",
						occurredAt: startedAt,
						sortOrder: 0,
						payload: JSON.stringify({ buyInAmount: 100 }),
					},
					{
						id: "e2",
						sessionId: "s1",
						eventType: "session_end",
						occurredAt: new Date("2026-08-01T12:00:00.000Z"),
						sortOrder: 1,
						payload: JSON.stringify({ cashOutAmount: 300 }),
					},
				],
				currency: [{ id: "c2", userId: OWNER }],
				currency_transaction: [],
				transaction_type: [
					{ id: "tt-1", userId: OWNER, name: "Session Result" },
				],
			},
		});

		await caller.liveCashGameSession.update({ id: "s1", currencyId: "c2" });

		expect(inserted.currency_transaction?.[0]).toMatchObject({
			sessionId: "s1",
			currencyId: "c2",
			amount: 200,
		});
	});
});

describe("liveCashGameSession.updateSnapshot writes", () => {
	it("writes every provided rule field onto session_cash_detail in one update", async () => {
		const { caller, updated } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [ownedSession],
				session_cash_detail: [
					{
						sessionId: "s1",
						variant: "NL Hold'em",
						mixGames: null,
						ruleName: "Cash Game",
					},
				],
			},
		});

		await caller.liveCashGameSession.updateSnapshot({
			id: "s1",
			ruleName: "New Rule",
			blind1: 5,
			blind2: 10,
			blind3: 20,
			ante: 5,
			anteType: "bb",
			minBuyIn: 100,
			maxBuyIn: 1000,
			tableSize: 6,
		});

		expect(updated.session_cash_detail?.[0]).toMatchObject({
			ruleName: "New Rule",
			blind1: 5,
			blind2: 10,
			blind3: 20,
			ante: 5,
			anteType: "bb",
			minBuyIn: 100,
			maxBuyIn: 1000,
			tableSize: 6,
		});
	});

	it("does not update session_cash_detail when no rule field is provided", async () => {
		const { caller, updated } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [ownedSession],
				session_cash_detail: [
					{
						sessionId: "s1",
						variant: "NL Hold'em",
						mixGames: null,
						ruleName: "Cash Game",
					},
				],
			},
		});

		await expect(
			caller.liveCashGameSession.updateSnapshot({ id: "s1" })
		).resolves.toEqual({ id: "s1" });
		expect(updated.session_cash_detail).toBeUndefined();
	});
});

describe("liveCashGameSession.complete", () => {
	it("appends a session_end event carrying the cash-out amount and resolves the session id", async () => {
		const { caller, inserted } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [{ ...ownedSession, status: "active", currencyId: null }],
				session_event: [],
			},
		});

		await expect(
			caller.liveCashGameSession.complete({ id: "s1", finalStack: 500 })
		).resolves.toEqual({ id: "s1", pokerSessionId: "s1" });

		const endEvent = inserted.session_event?.[0] as {
			eventType: string;
			payload: string;
		};
		expect(endEvent).toMatchObject({ eventType: "session_end" });
		expect(JSON.parse(endEvent.payload)).toMatchObject({ cashOutAmount: 500 });
	});
});

function createReopenSuccessMockDb(selectSequence: unknown[][]) {
	let selectCallIndex = 0;
	const inserted: Record<string, unknown[]> = {};
	const deleteWhereParams: unknown[][] = [];

	const select = () => ({
		from: () => {
			const rows = selectSequence[selectCallIndex] ?? [];
			selectCallIndex++;
			const chain = Promise.resolve(rows) as Promise<unknown[]> &
				Record<string, (...args: unknown[]) => unknown>;
			chain.where = () => chain;
			chain.orderBy = () => chain;
			chain.limit = () => chain;
			return chain;
		},
	});
	const insert = (table: unknown) => ({
		values: (values: unknown) => {
			const name = getTableName(table as never);
			const bucket = inserted[name] ?? [];
			bucket.push(values);
			inserted[name] = bucket;
			return Promise.resolve(undefined);
		},
	});
	const del = (_table: unknown) => ({
		where: (cond: unknown) => {
			deleteWhereParams.push(boundParams(cond));
			return Promise.resolve(undefined);
		},
	});
	const update = () => ({
		set: () => ({ where: () => Promise.resolve(undefined) }),
	});
	const batch = (statements: unknown[]) =>
		Promise.all(statements as Promise<unknown>[]);

	return {
		db: { select, insert, delete: del, update, batch } as never,
		inserted,
		deleteWhereParams,
	};
}

describe("liveCashGameSession.reopen success", () => {
	it("replaces the session_end event with the replay events and reactivates the session", async () => {
		const { db, inserted, deleteWhereParams } = createReopenSuccessMockDb([
			[{ ...ownedSession, status: "completed" }],
			[],
			[
				{
					id: "end-1",
					occurredAt: new Date("2026-08-01T12:00:00.000Z"),
					sortOrder: 4,
					payload: JSON.stringify({ cashOutAmount: 1200 }),
				},
			],
		]);
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await expect(
			caller.liveCashGameSession.reopen({ id: "s1" })
		).resolves.toEqual({ id: "s1" });

		expect(deleteWhereParams).toContainEqual(["end-1"]);
		const replayEvents = inserted.session_event as { eventType: string }[];
		expect(replayEvents.map((event) => event.eventType)).toEqual([
			"update_stack",
			"session_pause",
			"session_resume",
		]);
	});
});

describe("liveCashGameSession.updateHeroSeat", () => {
	it("returns without inserting a session_event when no hero is seated and heroSeatPosition stays null", async () => {
		const { caller, inserted } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [ownedSession],
				session_event: [],
			},
		});

		await expect(
			caller.liveCashGameSession.updateHeroSeat({
				id: "s1",
				heroSeatPosition: null,
			})
		).resolves.toEqual({ id: "s1" });
		expect(inserted.session_event).toBeUndefined();
	});

	it("inserts a player_leave event for the hero when clearing an occupied seat", async () => {
		const { caller, inserted } = createCaller({
			userId: OWNER,
			evaluateWhere: true,
			select: {
				game_session: [ownedSession],
				session_event: [
					{
						sessionId: "s1",
						eventType: "player_join",
						payload: JSON.stringify({ isHero: true, seatPosition: 3 }),
					},
				],
			},
		});

		await expect(
			caller.liveCashGameSession.updateHeroSeat({
				id: "s1",
				heroSeatPosition: null,
			})
		).resolves.toEqual({ id: "s1" });

		const leaveEvent = inserted.session_event?.[0] as {
			eventType: string;
			payload: string;
		};
		expect(leaveEvent).toMatchObject({ eventType: "player_leave" });
		expect(JSON.parse(leaveEvent.payload)).toMatchObject({ isHero: true });
	});
});
