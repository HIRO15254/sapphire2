import type { Database } from "@sapphire2/db";
import { currency } from "@sapphire2/db/schema/currency";
import { playEvent } from "@sapphire2/db/schema/entry";
import {
	assetRate,
	ledgerCategory,
	ledgerLine,
} from "@sapphire2/db/schema/ledger";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import { validateEntityOwnership } from "../routers/session";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	type LiveEntryStart,
	type NewPlayEvent,
} from "../services/entry-live-writes";
import { buildProjectionLineStatements } from "../services/entry-projector";
import {
	buildManualEntryInsertStatements,
	type EntrySessionFacts,
} from "../services/entry-session";
import {
	selectAssetBalances,
	selectAssetHistory,
	selectEntryRealTotals,
} from "../services/ledger-reads";
import {
	buildAdjustmentStatements,
	buildExchangeStatements,
	buildManualLineStatements,
	deleteWalletLine,
	type ManualEntryMoney,
	manualLineOccurredAt,
	manualMoneyPayments,
	updateWalletLine,
} from "../services/ledger-writes";
import {
	computeCashGamePLFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";
import { test } from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const JPY = "alice-jpy";
const USD = "alice-usd";
const TICKET = "alice-ticket";

function minutes(count: number): Date {
	return new Date(NOW.getTime() + count * 60_000);
}

async function seedAssets(db: Database) {
	await db.insert(currency).values([
		{ id: JPY, userId: "alice", name: "JPY", updatedAt: NOW },
		{ id: USD, userId: "alice", name: "USD", updatedAt: NOW },
		{
			id: TICKET,
			userId: "alice",
			name: "Main ticket",
			kind: "item",
			updatedAt: NOW,
		},
		{ id: "bob-jpy", userId: "bob", name: "JPY", updatedAt: NOW },
	]);
	await db.insert(ledgerCategory).values([
		{ id: "alice-deposit", userId: "alice", name: "Deposit", updatedAt: NOW },
		{ id: "bob-deposit", userId: "bob", name: "Deposit", updatedAt: NOW },
	]);
}

function manualFacts(
	id: string,
	kind: "cash_game" | "tournament"
): EntrySessionFacts {
	const base = {
		id,
		userId: "alice",
		source: "manual",
		sessionDate: new Date("2026-09-01T00:00:00.000Z"),
		startedAt: null,
		endedAt: null,
		breakMinutes: null,
		memo: null,
		roomId: null,
		currencyId: JPY,
		ruleName: null,
	};
	return kind === "cash_game"
		? {
				...base,
				kind,
				cash: { ringGameId: null, cashOut: null, evCashOut: null },
			}
		: {
				...base,
				kind,
				tournament: {
					tournamentId: null,
					placement: null,
					totalEntries: null,
					beforeDeadline: null,
				},
			};
}

async function writeManual(
	db: Database,
	facts: EntrySessionFacts,
	money: ManualEntryMoney,
	options: { insertEntry: boolean }
) {
	await runBatch(db, [
		...(options.insertEntry
			? buildManualEntryInsertStatements(db, facts, NOW)
			: []),
		...buildManualLineStatements(
			db,
			{
				entryId: facts.id,
				userId: facts.userId,
				playSessionId: facts.id,
				occurredAt: manualLineOccurredAt(null, "2026-09-01"),
			},
			manualMoneyPayments(JPY, money),
			NOW
		),
	]);
}

async function realProfitLoss(db: Database, entryId: string) {
	const totals = await selectEntryRealTotals(db, "alice", [entryId]);
	return totals.map(({ assetId, profitLoss }) => ({ assetId, profitLoss }));
}

function liveStart(
	id: string,
	detail: LiveEntryStart["detail"],
	payload: unknown
): LiveEntryStart {
	return {
		id,
		userId: "alice",
		detail,
		assetId: JPY,
		roomId: null,
		title: null,
		memo: null,
		localDate: "2026-09-05",
		now: NOW,
		startEvent: { schemaVersion: 1, occurredAt: NOW, payload },
	};
}

async function appendAndProject(
	db: Database,
	entryId: string,
	events: NewPlayEvent[]
) {
	const { projection } = await applyEntryEventChange(
		db,
		"alice",
		entryId,
		{ op: "append", events },
		minutes(600)
	);
	await runBatch(
		db,
		buildProjectionLineStatements(
			db,
			{ entryId, userId: "alice" },
			projection.lines,
			minutes(600)
		)
	);
}

async function legacyEvents(db: Database, entryId: string) {
	const rows = await db
		.select({ eventType: playEvent.type, payload: playEvent.payload })
		.from(playEvent)
		.where(eq(playEvent.entryId, entryId))
		.orderBy(asc(playEvent.occurredAt), asc(playEvent.sortOrder));
	return rows;
}

describe("audit A-5: the real P/L of the ledger lines equals the P/L of the old columns", () => {
	test("for manual cash and tournament input, including a rewrite of the same entry", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		const cash = manualFacts("manual-cash", "cash_game");
		await writeManual(
			db,
			cash,
			{ kind: "cash", buyIn: 30_000, chipRemoveTotal: 5000, cashOut: 42_000 },
			{ insertEntry: true }
		);
		expect(await realProfitLoss(db, cash.id)).toEqual([
			{ assetId: JPY, profitLoss: 42_000 + 5000 - 30_000 },
		]);

		await writeManual(
			db,
			cash,
			{ kind: "cash", buyIn: 30_000, chipRemoveTotal: null, cashOut: 0 },
			{ insertEntry: false }
		);
		expect(await realProfitLoss(db, cash.id)).toEqual([
			{ assetId: JPY, profitLoss: 0 + 0 - 30_000 },
		]);

		const mtt = manualFacts("manual-mtt", "tournament");
		await writeManual(
			db,
			mtt,
			{
				kind: "tournament",
				buyIn: 10_000,
				entryFee: 1000,
				prizeMoney: 30_000,
				bountyPrizes: 2000,
				chipPurchases: [
					{ cost: 2000, count: 2 },
					{ cost: 3000, count: 1 },
					{ cost: 9000, count: 0 },
				],
			},
			{ insertEntry: true }
		);
		expect(await realProfitLoss(db, mtt.id)).toEqual([
			{
				assetId: JPY,
				profitLoss: 30_000 + 2000 - (10_000 + 1000 + 2000 * 2 + 3000 * 1),
			},
		]);
		const rebuys = await db
			.select({ id: ledgerLine.id })
			.from(ledgerLine)
			.where(eq(ledgerLine.role, "chip_purchase"))
			.orderBy(asc(ledgerLine.id));
		expect(rebuys.map(({ id }) => id)).toEqual([
			"m:manual-mtt:chip_purchase:0",
			"m:manual-mtt:chip_purchase:1",
			"m:manual-mtt:chip_purchase:2",
		]);
	});

	test("for live cash and tournament event logs, rebuilt as often as the events change", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		await runBatch(
			db,
			buildLiveEntryStartStatements(
				db,
				liveStart(
					"live-cash",
					{ kind: "cash", ringGameId: null },
					{ buyInAmount: 30_000 }
				)
			)
		);
		await appendAndProject(db, "live-cash", [
			{
				type: "chips_add_remove",
				schemaVersion: 1,
				occurredAt: minutes(30),
				payload: { amount: 10_000 },
			},
			{
				type: "chips_add_remove",
				schemaVersion: 1,
				occurredAt: minutes(60),
				payload: { amount: -5000 },
			},
		]);
		await appendAndProject(db, "live-cash", [
			{
				type: "session_end",
				schemaVersion: 1,
				occurredAt: minutes(240),
				payload: { cashOutAmount: 20_000 },
			},
		]);
		const cashPl = computeCashGamePLFromEvents(
			await legacyEvents(db, "live-cash")
		).profitLoss;
		expect(cashPl).toBe(20_000 + 5000 - (30_000 + 10_000));
		expect(await realProfitLoss(db, "live-cash")).toEqual([
			{ assetId: JPY, profitLoss: cashPl },
		]);

		await runBatch(
			db,
			buildLiveEntryStartStatements(
				db,
				liveStart(
					"live-mtt",
					{
						kind: "tournament",
						tournamentId: null,
						buyIn: 10_000,
						entryFee: 1000,
					},
					{ timerStartedAt: null }
				)
			)
		);
		await db.insert(sessionTournamentDetail).values({
			sessionId: "live-mtt",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
		});
		await appendAndProject(db, "live-mtt", [
			{
				type: "purchase_chips",
				schemaVersion: 1,
				occurredAt: minutes(60),
				payload: {
					sessionChipPurchaseId: "rebuy",
					name: "Rebuy",
					cost: 2000,
					chips: 10_000,
				},
			},
			{
				type: "purchase_chips",
				schemaVersion: 1,
				occurredAt: minutes(90),
				payload: {
					sessionChipPurchaseId: "rebuy",
					name: "Rebuy",
					cost: 2000,
					chips: 10_000,
				},
			},
			{
				type: "session_end",
				schemaVersion: 1,
				occurredAt: minutes(400),
				payload: {
					beforeDeadline: false,
					placement: 4,
					totalEntries: 120,
					prizeMoney: 50_000,
					bountyPrizes: 3000,
				},
			},
		]);
		const tournamentPl = computeTournamentPLFromEvents(
			await legacyEvents(db, "live-mtt"),
			10_000,
			1000
		).profitLoss;
		expect(tournamentPl).toBe(50_000 + 3000 - (10_000 + 1000 + 2000 * 2));
		expect(await realProfitLoss(db, "live-mtt")).toEqual([
			{ assetId: JPY, profitLoss: tournamentPl },
		]);
	});

	test("a live money event in an entry without a currency is rejected before any line is written", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		await runBatch(
			db,
			buildLiveEntryStartStatements(db, {
				...liveStart(
					"no-currency",
					{ kind: "cash", ringGameId: null },
					{ buyInAmount: 30_000 }
				),
				assetId: null,
			})
		);
		await expect(
			appendAndProject(db, "no-currency", [
				{
					type: "session_end",
					schemaVersion: 1,
					occurredAt: minutes(60),
					payload: { cashOutAmount: 10_000 },
				},
			])
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(await db.select().from(ledgerLine)).toEqual([]);
	});
});

describe("wallet lines, balances and history", () => {
	test("the balance counts real entry and wallet lines, the history lists each wallet line and one total per entry, and pages by its cursor", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		await writeManual(
			db,
			manualFacts("settled", "cash_game"),
			{ kind: "cash", buyIn: 30_000, chipRemoveTotal: null, cashOut: 50_000 },
			{ insertEntry: true }
		);
		const deposit = buildAdjustmentStatements(
			db,
			"alice",
			{
				assetId: JPY,
				quantity: 100_000,
				categoryId: "alice-deposit",
				occurredAt: new Date("2026-08-01T00:00:00.000Z"),
				memo: "Opening balance",
			},
			NOW
		);
		const exchange = buildExchangeStatements(
			db,
			"alice",
			{
				from: { assetId: JPY, quantity: 15_000 },
				to: { assetId: USD, quantity: 100 },
				categoryId: null,
				occurredAt: new Date("2026-09-03T00:00:00.000Z"),
				memo: null,
			},
			NOW
		);
		await runBatch(db, [...deposit.statements, ...exchange.statements]);

		const balances = await selectAssetBalances(db, "alice");
		expect(
			Object.fromEntries(balances.map((row) => [row.assetId, row.balance]))
		).toEqual({
			[JPY]: 100_000 + (50_000 - 30_000) - 15_000,
			[USD]: 100,
			[TICKET]: 0,
		});

		const firstPage = await selectAssetHistory(db, "alice", JPY, { limit: 2 });
		expect(firstPage).toMatchObject([
			{ id: exchange.ids[0], quantity: -15_000, role: "exchange" },
			{ id: "settled", entryId: "settled", quantity: 20_000, role: null },
		]);
		const last = firstPage.at(-1);
		if (!last) {
			throw new Error("Expected a first page");
		}
		const secondPage = await selectAssetHistory(db, "alice", JPY, {
			limit: 2,
			cursor: { id: last.id, occurredAt: last.occurredAt },
		});
		expect(secondPage).toMatchObject([
			{
				id: deposit.id,
				quantity: 100_000,
				categoryId: "alice-deposit",
				memo: "Opening balance",
				occurredAt: new Date("2026-08-01T00:00:00.000Z"),
			},
		]);
	});

	test("only the owner's wallet lines change, an exchange stays a pair of opposite lines in two assets, and entry lines are left to their entry", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		await writeManual(
			db,
			manualFacts("settled", "cash_game"),
			{ kind: "cash", buyIn: 30_000, chipRemoveTotal: null, cashOut: 50_000 },
			{ insertEntry: true }
		);
		const exchange = buildExchangeStatements(
			db,
			"alice",
			{
				from: { assetId: JPY, quantity: 15_000 },
				to: { assetId: USD, quantity: 100 },
				categoryId: null,
				occurredAt: NOW,
				memo: null,
			},
			NOW
		);
		await runBatch(db, exchange.statements);
		const [outgoing, incoming] = exchange.ids;

		expect(() =>
			buildExchangeStatements(
				db,
				"alice",
				{
					from: { assetId: JPY, quantity: 1 },
					to: { assetId: JPY, quantity: 1 },
					categoryId: null,
					occurredAt: NOW,
					memo: null,
				},
				NOW
			)
		).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
		await expect(
			updateWalletLine(db, "alice", outgoing, { quantity: 15_000 }, NOW)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			updateWalletLine(db, "bob", outgoing, { memo: "mine" }, NOW)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(deleteWalletLine(db, "bob", outgoing)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		await expect(
			updateWalletLine(db, "alice", "m:settled:cash_out:0", { memo: "x" }, NOW)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			deleteWalletLine(db, "alice", "m:settled:buy_in:0")
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		await updateWalletLine(
			db,
			"alice",
			incoming,
			{ quantity: 110, memo: "Better rate", occurredAt: minutes(5) },
			minutes(10)
		);
		const pair = await db
			.select({
				id: ledgerLine.id,
				quantity: ledgerLine.quantity,
				memo: ledgerLine.memo,
				occurredAt: ledgerLine.occurredAt,
			})
			.from(ledgerLine)
			.where(eq(ledgerLine.transferId, exchange.transferId));
		expect(pair).toEqual(
			expect.arrayContaining([
				{
					id: outgoing,
					quantity: -15_000,
					memo: "Better rate",
					occurredAt: minutes(5),
				},
				{
					id: incoming,
					quantity: 110,
					memo: "Better rate",
					occurredAt: minutes(5),
				},
			])
		);

		await deleteWalletLine(db, "alice", incoming);
		const remaining = await db
			.select({ id: ledgerLine.id })
			.from(ledgerLine)
			.orderBy(asc(ledgerLine.id));
		expect(remaining.map(({ id }) => id)).toEqual([
			"m:settled:buy_in:0",
			"m:settled:cash_out:0",
		]);
	});
});

describe("validateEntityOwnership for the ledger kinds", () => {
	test("returns the owner's asset, rate, category and line, and refuses them to another user", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		await db.insert(assetRate).values({
			id: "alice-rate",
			userId: "alice",
			baseAssetId: TICKET,
			quoteAssetId: JPY,
			rateNum: 20_000,
			rateDen: 1,
			effectiveFrom: new Date(0),
		});
		const deposit = buildAdjustmentStatements(
			db,
			"alice",
			{
				assetId: JPY,
				quantity: 1000,
				categoryId: null,
				occurredAt: NOW,
				memo: null,
			},
			NOW
		);
		await runBatch(db, deposit.statements);

		const owned = [
			["asset", JPY],
			["assetRate", "alice-rate"],
			["ledgerCategory", "alice-deposit"],
			["ledgerLine", deposit.id],
		] as const;
		for (const [kind, id] of owned) {
			await expect(
				validateEntityOwnership(db, kind as "asset", id, "alice")
			).resolves.toMatchObject({ id, userId: "alice" });
			await expect(
				validateEntityOwnership(db, kind as "asset", id, "bob")
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
	});
});
