import type { Database } from "@sapphire2/db";
import { asset } from "@sapphire2/db/schema/asset";
import {
	assetRate,
	ledgerCategory,
	ledgerLine,
} from "@sapphire2/db/schema/ledger";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	type LiveEntryStart,
	type NewPlayEvent,
} from "../services/entry-live-writes";
import { buildProjectionLineStatements } from "../services/entry-projector";
import { planEntryRule } from "../services/entry-rules";
import { createManualEntry } from "../services/entry-writes";
import {
	selectAssetBalances,
	selectAssetHistory,
	selectEntryRealTotals,
} from "../services/ledger-reads";
import {
	buildAdjustmentStatements,
	buildExchangeStatements,
	deleteWalletLine,
	updateWalletLine,
} from "../services/ledger-writes";
import { nlhGame, test } from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const JPY = "alice-jpy";
const USD = "alice-usd";
const TICKET = "alice-ticket";

function minutes(count: number): Date {
	return new Date(NOW.getTime() + count * 60_000);
}

async function seedAssets(db: Database) {
	await db.insert(asset).values([
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

async function seedSettledCash(db: Database): Promise<string> {
	return await createManualEntry(
		db,
		"alice",
		{
			kind: "cash",
			playedOn: "2026-09-01",
			rule: await nlhGame(db),
			payments: [
				{ role: "buy_in", assetId: JPY, quantity: 30_000, effect: "real" },
				{ role: "cash_out", assetId: JPY, quantity: 50_000, effect: "real" },
			],
		},
		NOW
	);
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
		startEvent: { occurredAt: NOW, payload },
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

describe("entry ledger real profit and loss", () => {
	test("for live cash and tournament event logs, rebuilt as often as the events change", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		const cashRule = await planEntryRule(db, "alice", {
			kind: "cash",
			ringGameId: null,
			rule: await nlhGame(db),
		});
		const tournamentRule = await planEntryRule(db, "alice", {
			kind: "tournament",
			tournamentId: null,
			rule: {
				prices: [
					{
						kind: "entry",
						assetId: JPY,
						amount: 10_000,
						fee: 1000,
						chips: null,
					},
				],
			},
		});
		await runBatch(db, [...cashRule.statements, ...tournamentRule.statements]);
		await runBatch(
			db,
			buildLiveEntryStartStatements(
				db,
				liveStart(
					"live-cash",
					{
						kind: "cash",
						ringGameId: null,
						cashRuleId: cashRule.ruleVersionId,
					},
					{ payments: [{ assetId: JPY, quantity: 30_000, role: "buy_in" }] }
				)
			)
		);
		await appendAndProject(db, "live-cash", [
			{
				type: "chips_add_remove",
				occurredAt: minutes(30),
				payload: { amount: 10_000, assetId: JPY, effect: "real" },
			},
			{
				type: "chips_add_remove",
				occurredAt: minutes(60),
				payload: { amount: -5000, assetId: JPY, effect: "real" },
			},
		]);
		await appendAndProject(db, "live-cash", [
			{
				type: "session_end",
				occurredAt: minutes(240),
				payload: {
					payments: [{ assetId: JPY, quantity: 20_000, role: "cash_out" }],
				},
			},
		]);
		const cashPl = -15_000;
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
						tournamentRuleId: tournamentRule.ruleVersionId,
					},
					{
						timerStartedAt: null,
						payments: [
							{ assetId: JPY, quantity: 10_000, role: "buy_in" },
							{ assetId: JPY, quantity: 1000, role: "fee" },
						],
					}
				)
			)
		);
		await db.insert(gameSession).values({
			id: "live-mtt",
			userId: "alice",
			kind: "tournament",
			status: "active",
			source: "live",
			sessionDate: NOW,
			currencyId: JPY,
			updatedAt: NOW,
		});
		await db.insert(sessionTournamentDetail).values({
			sessionId: "live-mtt",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
		});
		await appendAndProject(db, "live-mtt", [
			{
				type: "purchase_chips",
				occurredAt: minutes(60),
				payload: {
					priceId: "rebuy",
					label: "Rebuy",
					chips: 10_000,
					payments: [{ assetId: JPY, quantity: 2000, role: "chip_purchase" }],
				},
			},
			{
				type: "purchase_chips",
				occurredAt: minutes(90),
				payload: {
					priceId: "rebuy",
					label: "Rebuy",
					chips: 10_000,
					payments: [{ assetId: JPY, quantity: 2000, role: "chip_purchase" }],
				},
			},
			{
				type: "session_end",
				occurredAt: minutes(400),
				payload: {
					beforeDeadline: false,
					placement: 4,
					totalEntries: 120,
					payments: [
						{ assetId: JPY, quantity: 50_000, role: "prize" },
						{ assetId: JPY, quantity: 3000, role: "bounty" },
					],
				},
			},
		]);
		const tournamentPl = 50_000 + 3000 - 10_000 - 1000 - 2 * 2000;
		expect(await realProfitLoss(db, "live-mtt")).toEqual([
			{ assetId: JPY, profitLoss: tournamentPl },
		]);
	});

	test("live money events use their explicit asset even without an entry currency", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		const cashRule = await planEntryRule(db, "alice", {
			kind: "cash",
			ringGameId: null,
			rule: await nlhGame(db),
		});
		await runBatch(db, cashRule.statements);
		await runBatch(
			db,
			buildLiveEntryStartStatements(db, {
				...liveStart(
					"no-currency",
					{
						kind: "cash",
						ringGameId: null,
						cashRuleId: cashRule.ruleVersionId,
					},
					{ payments: [] }
				),
				assetId: null,
			})
		);
		await appendAndProject(db, "no-currency", [
			{
				type: "session_end",
				occurredAt: minutes(60),
				payload: {
					payments: [{ assetId: JPY, quantity: 10_000, role: "cash_out" }],
				},
			},
		]);
		expect(await realProfitLoss(db, "no-currency")).toEqual([
			{ assetId: JPY, profitLoss: 10_000 },
		]);
	});
});

describe("wallet lines, balances and history", () => {
	test("the balance counts real entry and wallet lines, the history lists each wallet line and one total per entry, and pages by its cursor", async ({
		api: { db },
	}) => {
		await seedAssets(db);
		const settled = await seedSettledCash(db);
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
			{ id: settled, entryId: settled, quantity: 20_000, role: null },
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
		const settled = await seedSettledCash(db);
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
			updateWalletLine(
				db,
				"alice",
				`m:${settled}:cash_out:0`,
				{ memo: "x" },
				NOW
			)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			deleteWalletLine(db, "alice", `m:${settled}:buy_in:0`)
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
			`m:${settled}:buy_in:0`,
			`m:${settled}:cash_out:0`,
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
