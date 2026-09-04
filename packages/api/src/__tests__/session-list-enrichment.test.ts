import { describe, expect, it } from "vitest";
import {
	encodeSessionCursor,
	type ProfitLossSeriesRow,
	toProfitLossSeriesPoint,
} from "../routers/session";
import { createCaller } from "./caller";

const CALLER = "user-1";

function makeCaller(select: Record<string, Record<string, unknown>[]> = {}) {
	return createCaller({ select, userId: CALLER });
}

function listCallerRows(rows: Record<string, unknown>[]) {
	return makeCaller({
		game_session: rows.map((row, index) => ({
			id: `session-${index + 1}`,
			type: "cash_game",
			source: "manual",
			buyIn: null,
			cashOut: null,
			evCashOut: null,
			chipRemoveTotal: null,
			...row,
		})),
		session_chip_purchase: [],
		session_blind_level: [],
		session_to_session_tag: [],
	}).caller;
}

function listCaller(row: Record<string, unknown>) {
	return listCallerRows([row]);
}

function profitLossSeriesRow(
	overrides: Partial<ProfitLossSeriesRow>
): ProfitLossSeriesRow {
	return {
		bountyPrizes: null,
		breakMinutes: null,
		buyIn: null,
		cashOut: null,
		chipPurchaseCost: 0,
		chipRemoveTotal: null,
		endedAt: null,
		entryFee: null,
		evCashOut: null,
		id: "s1",
		prizeMoney: null,
		ringGameBlind2: null,
		sessionDate: new Date(1_700_000_000_000),
		startedAt: null,
		tournamentBuyIn: null,
		type: "cash_game",
		...overrides,
	};
}

describe("session.list groups chip purchases and blind levels per session (SA2-151)", () => {
	it("groups each session's own rows and defaults a missing count to 0", async () => {
		const { caller } = makeCaller({
			game_session: [
				{
					id: "session-1",
					type: "cash_game",
					source: "manual",
					buyIn: null,
					cashOut: null,
					evCashOut: null,
				},
				{
					id: "session-2",
					type: "cash_game",
					source: "manual",
					buyIn: null,
					cashOut: null,
					evCashOut: null,
				},
			],
			session_chip_purchase: [
				{
					sessionId: "session-1",
					id: "cp-1",
					name: "Rebuy",
					cost: 50,
					chips: 1000,
					sortOrder: 0,
					count: 3,
				},
				{
					sessionId: "session-2",
					id: "cp-2",
					name: "Addon",
					cost: 20,
					chips: 500,
					sortOrder: 0,
				},
			],
			session_blind_level: [
				{
					sessionId: "session-1",
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
					minutes: 20,
					games: null,
				},
				{
					sessionId: "session-2",
					isBreak: true,
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
					minutes: 10,
					games: null,
				},
			],
			session_to_session_tag: [],
		});

		const { items } = await caller.session.list({});

		const s1 = items.find((item) => item.id === "session-1");
		const s2 = items.find((item) => item.id === "session-2");

		expect(s1?.chipPurchases).toEqual([
			{
				id: "cp-1",
				name: "Rebuy",
				cost: 50,
				chips: 1000,
				sortOrder: 0,
				count: 3,
			},
		]);
		expect(s2?.chipPurchases).toEqual([
			{
				id: "cp-2",
				name: "Addon",
				cost: 20,
				chips: 500,
				sortOrder: 0,
				count: 0,
			},
		]);
		expect(s1?.blindLevels).toEqual([
			{
				isBreak: false,
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: null,
				minutes: 20,
				games: null,
			},
		]);
		expect(s2?.blindLevels).toEqual([
			{
				isBreak: true,
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
				minutes: 10,
				games: null,
			},
		]);
	});
});

describe("session.list EV summary requires an actual cash-out to fall back to", () => {
	it("leaves the summary EV totals null for a cash session with a buy-in but no cash-out at all", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: null, evCashOut: null });

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBeNull();
		expect(summary.totalEvDiff).toBeNull();
	});
});

describe("session.list keyset cursor WHERE bindings (SA2-150)", () => {
	it("binds the floored cursor seconds twice and the cursor id once into the page query", async () => {
		const cursor = encodeSessionCursor({
			id: "session-5",
			sessionDate: new Date(1_700_000_000_000),
			startedAt: null,
		});
		const { caller, selectWhereParams } = makeCaller({ game_session: [] });

		await caller.session.list({ cursor });

		expect(selectWhereParams[0]).toEqual([
			CALLER,
			1_700_000_000,
			1_700_000_000,
			"session-5",
		]);
	});
});

describe("toProfitLossSeriesPoint playMinutes (computePlayMinutes)", () => {
	it("subtracts breakMinutes from the elapsed startedAt-to-endedAt time", () => {
		const t0 = 1_700_000_000_000;
		const point = toProfitLossSeriesPoint(
			profitLossSeriesRow({
				startedAt: new Date(t0),
				endedAt: new Date(t0 + 3_600_000),
				breakMinutes: 10,
			})
		);

		expect(point.playMinutes).toBe(50);
	});
});

describe("session.profitLossSeries filter WHERE bindings", () => {
	it.each([
		{
			label: "type",
			input: { type: "tournament" as const },
			param: "tournament",
		},
		{
			label: "dateFrom",
			input: { dateFrom: 1_700_000_000 },
			param: 1_700_000_000,
		},
		{ label: "dateTo", input: { dateTo: 1_800_000_000 }, param: 1_800_000_000 },
	])("binds the $label filter into the series query's WHERE", async ({
		input,
		param,
	}) => {
		const { caller, selectWhereParams } = makeCaller({ game_session: [] });

		await caller.session.profitLossSeries(input);

		expect(selectWhereParams[0]).toEqual([CALLER, param]);
	});
});

describe("session.profitLossSeries includes chip purchase cost in each point", () => {
	it("subtracts chip purchase cost x count from a tournament point's profitLoss", async () => {
		const { caller } = makeCaller({
			game_session: [
				{
					id: "session-1",
					type: "tournament",
					sessionDate: new Date(1_700_000_000_000),
					startedAt: null,
					endedAt: null,
					breakMinutes: null,
					buyIn: null,
					cashOut: null,
					evCashOut: null,
					chipRemoveTotal: null,
					ringGameBlind2: null,
					tournamentBuyIn: 100,
					entryFee: 10,
					prizeMoney: 500,
					bountyPrizes: 0,
				},
			],
			session_chip_purchase: [
				{
					sessionId: "session-1",
					id: "cp-1",
					name: "Rebuy",
					cost: 50,
					chips: 1000,
					sortOrder: 0,
					count: 2,
				},
			],
		});

		const { points } = await caller.session.profitLossSeries({});

		expect(points[0]).toMatchObject({ id: "session-1", profitLoss: 290 });
	});
});

describe("session.list liveCashGameSessionId / liveTournamentSessionId (enrichItemWithPL)", () => {
	it.each([
		{
			type: "cash_game" as const,
			expectedCash: "session-1",
			expectedTournament: null,
		},
		{
			type: "tournament" as const,
			expectedCash: null,
			expectedTournament: "session-1",
		},
	])("sets only the matching live id field for a live $type session", async ({
		type,
		expectedCash,
		expectedTournament,
	}) => {
		const caller = listCaller({
			source: "live",
			type,
			buyIn: null,
			cashOut: null,
			evCashOut: null,
		});

		const { items } = await caller.session.list({});

		expect(items[0]).toMatchObject({
			liveCashGameSessionId: expectedCash,
			liveTournamentSessionId: expectedTournament,
		});
	});
});

describe("session.list attaches tags only to the session actually linked (SA2-179)", () => {
	it("leaves an unlinked session's tags empty", async () => {
		const { caller } = makeCaller({
			game_session: [
				{
					id: "session-1",
					type: "cash_game",
					source: "manual",
					buyIn: null,
					cashOut: null,
					evCashOut: null,
				},
				{
					id: "session-2",
					type: "cash_game",
					source: "manual",
					buyIn: null,
					cashOut: null,
					evCashOut: null,
				},
			],
			session_chip_purchase: [],
			session_blind_level: [],
			session_to_session_tag: [
				{ sessionId: "session-1", tagId: "tag-1", tagName: "Bounty" },
			],
		});

		const { items } = await caller.session.list({});

		const s1 = items.find((item) => item.id === "session-1");
		const s2 = items.find((item) => item.id === "session-2");
		expect(s1?.tags).toEqual([{ id: "tag-1", name: "Bounty" }]);
		expect(s2?.tags).toEqual([]);
	});
});

describe("session.list pagination", () => {
	it("caps a page at 20 items and returns a cursor when a 21st row exists", async () => {
		const rows = Array.from({ length: 21 }, (_, index) => ({
			id: `session-${index + 1}`,
			type: "cash_game",
			source: "manual",
			buyIn: null,
			cashOut: null,
			evCashOut: null,
			sessionDate: new Date(1_700_000_000_000 + index * 86_400_000),
			startedAt: null,
		}));
		const { caller } = makeCaller({
			game_session: rows,
			session_chip_purchase: [],
			session_blind_level: [],
			session_to_session_tag: [],
		});

		const { items, nextCursor } = await caller.session.list({});

		expect(items).toHaveLength(20);
		expect(typeof nextCursor).toBe("string");
	});
});
