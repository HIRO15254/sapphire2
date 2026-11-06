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
		{ id: JPY, name: "JPY", updatedAt: NOW, userId: "alice" },
		{ id: USD, name: "USD", updatedAt: NOW, userId: "alice" },
		{
			id: TICKET,
			kind: "item",
			name: "Main ticket",
			updatedAt: NOW,
			userId: "alice",
		},
		{ id: "bob-jpy", name: "JPY", updatedAt: NOW, userId: "bob" },
	]);
	await db.insert(ledgerCategory).values([
		{ id: "alice-deposit", name: "Deposit", updatedAt: NOW, userId: "alice" },
		{ id: "bob-deposit", name: "Deposit", updatedAt: NOW, userId: "bob" },
	]);
}

async function seedSettledCash(db: Database): Promise<string> {
	return await createManualEntry(
		db,
		"alice",
		{
			kind: "cash",
			payments: [
				{ assetId: JPY, effect: "real", quantity: 30_000, role: "buy_in" },
				{ assetId: JPY, effect: "real", quantity: 50_000, role: "cash_out" },
			],
			playedOn: "2026-09-01",
			rule: await nlhGame(db),
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
		assetId: JPY,
		detail,
		id,
		localDate: "2026-09-05",
		memo: null,
		now: NOW,
		roomId: null,
		startEvent: { occurredAt: NOW, payload },
		userId: "alice",
	};
}

async function appendAndProject(
	db: Database,
	entryId: string,
	events: NewPlayEvent[]
) {
	const state = await loadEntryEventState(db, "alice", entryId);
	await commitEntryEventChange(db, {
		change: { events, op: "append" },
		entryId,
		now: minutes(600),
		state,
		userId: "alice",
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
			rule: {
				prices: [
					{
						amount: 10_000,
						assetId: JPY,
						chips: null,
						fee: 1000,
						kind: "entry",
					},
				],
			},
			tournamentId: null,
		});
		await runBatch(db, [...cashRule.statements, ...tournamentRule.statements]);
		await runBatch(
			db,
			buildLiveEntryStartStatements(
				db,
				liveStart(
					"live-cash",
					{
						cashRuleId: cashRule.ruleVersionId,
						kind: "cash",
						ringGameId: null,
					},
					{ payments: [{ assetId: JPY, quantity: 30_000, role: "buy_in" }] }
				)
			)
		);
		await appendAndProject(db, "live-cash", [
			{
				occurredAt: minutes(30),
				payload: { amount: 10_000, assetId: JPY, effect: "real" },
				type: "chips_add_remove",
			},
			{
				occurredAt: minutes(60),
				payload: { amount: -5000, assetId: JPY, effect: "real" },
				type: "chips_add_remove",
			},
		]);
		await appendAndProject(db, "live-cash", [
			{
				occurredAt: minutes(240),
				payload: {
					payments: [{ assetId: JPY, quantity: 20_000, role: "cash_out" }],
				},
				type: "session_end",
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
						payments: [
							{ assetId: JPY, quantity: 10_000, role: "buy_in" },
							{ assetId: JPY, quantity: 1000, role: "fee" },
						],
						timerStartedAt: null,
					}
				)
			)
		);
		await appendAndProject(db, "live-mtt", [
			{
				occurredAt: minutes(60),
				payload: {
					chips: 10_000,
					label: "Rebuy",
					payments: [{ assetId: JPY, quantity: 2000, role: "chip_purchase" }],
					priceId: "rebuy",
				},
				type: "purchase_chips",
			},
			{
				occurredAt: minutes(90),
				payload: {
					chips: 10_000,
					label: "Rebuy",
					payments: [{ assetId: JPY, quantity: 2000, role: "chip_purchase" }],
					priceId: "rebuy",
				},
				type: "purchase_chips",
			},
			{
				occurredAt: minutes(400),
				payload: {
					beforeDeadline: false,
					payments: [
						{ assetId: JPY, quantity: 50_000, role: "prize" },
						{ assetId: JPY, quantity: 3000, role: "bounty" },
					],
					placement: 4,
					totalEntries: 120,
				},
				type: "session_end",
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
						cashRuleId: cashRule.ruleVersionId,
						kind: "cash",
						ringGameId: null,
					},
					{ payments: [] }
				),
				assetId: null,
			})
		);
		await appendAndProject(db, "no-currency", [
			{
				occurredAt: minutes(60),
				payload: {
					payments: [{ assetId: JPY, quantity: 10_000, role: "cash_out" }],
				},
				type: "session_end",
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
				categoryId: "alice-deposit",
				memo: "Opening balance",
				occurredAt: new Date("2026-08-01T00:00:00.000Z"),
				quantity: 100_000,
			},
			NOW
		);
		const exchange = buildExchangeStatements(
			db,
			"alice",
			{
				categoryId: null,
				from: { assetId: JPY, quantity: 15_000 },
				memo: null,
				occurredAt: new Date("2026-09-03T00:00:00.000Z"),
				to: { assetId: USD, quantity: 100 },
			},
			NOW
		);
		await runBatch(db, [...deposit.statements, ...exchange.statements]);

		const firstPage = await selectAssetHistory(db, "alice", JPY, { limit: 2 });
		expect(firstPage).toMatchObject([
			{ id: exchange.ids[0], quantity: -15_000, role: "exchange" },
			{ entryId: settled, id: settled, quantity: 20_000, role: null },
		]);
		const last = firstPage.at(-1);
		if (!last) {
			throw new Error("Expected a first page");
		}
		const secondPage = await selectAssetHistory(db, "alice", JPY, {
			cursor: { id: last.id, occurredAt: last.occurredAt },
			limit: 2,
		});
		expect(secondPage).toMatchObject([
			{
				categoryId: "alice-deposit",
				id: deposit.id,
				memo: "Opening balance",
				occurredAt: new Date("2026-08-01T00:00:00.000Z"),
				quantity: 100_000,
			},
		]);
	});
});
