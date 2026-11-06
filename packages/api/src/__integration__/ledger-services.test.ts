import type { Database } from "@sapphire2/db";
import { asset } from "@sapphire2/db/schema/asset";
import { ledgerCategory } from "@sapphire2/db/schema/ledger";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import {
	buildLiveEntryStartStatements,
	commitEntryEventChange,
	type LiveEntryStart,
	loadEntryEventState,
	type NewPlayEvent,
} from "../services/entry-live-writes";
import { planEntryRule } from "../services/entry-rules";
import { createManualEntry } from "../services/entry-writes";
import { selectAssetHistory } from "../services/ledger-reads";
import {
	buildAdjustmentStatements,
	buildExchangeStatements,
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
	const state = await loadEntryEventState(db, "alice", entryId);
	await commitEntryEventChange(db, {
		userId: "alice",
		entryId,
		state,
		change: { op: "append", events },
		now: minutes(600),
	});
}

describe("entry ledger real profit and loss", () => {
	test("for live cash and tournament event logs, rebuilt as often as the events change", async ({
		api,
	}) => {
		const { db } = api;
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
		expect((await api.alice.entry.getById({ id: "live-cash" })).totals).toEqual(
			[
				expect.objectContaining({
					assetId: JPY,
					effect: "real",
					profitLoss: cashPl,
				}),
			]
		);

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
		expect((await api.alice.entry.getById({ id: "live-mtt" })).totals).toEqual([
			expect.objectContaining({
				assetId: JPY,
				effect: "real",
				profitLoss: tournamentPl,
			}),
		]);
	});

	test("live money events use their explicit asset even without an entry currency", async ({
		api,
	}) => {
		const { db } = api;
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
		expect(
			(await api.alice.entry.getById({ id: "no-currency" })).totals
		).toEqual([
			expect.objectContaining({
				assetId: JPY,
				effect: "real",
				profitLoss: 10_000,
			}),
		]);
	});
});

describe("wallet history", () => {
	test("pages across an entry total between wallet lines", async ({
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
});
