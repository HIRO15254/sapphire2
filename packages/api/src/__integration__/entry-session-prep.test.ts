import type { Database } from "@sapphire2/db";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionToSessionTag } from "@sapphire2/db/schema/session-tag";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { describe, expect } from "vitest";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

const SEP_1 = Date.UTC(2026, 8, 1) / 1000;

function errorMessages(error: unknown): string {
	const messages: string[] = [];
	for (
		let cause: unknown = error;
		cause instanceof Error;
		cause = cause.cause
	) {
		messages.push(cause.message);
	}
	return messages.join("\n");
}

async function everyRow(db: Database) {
	return {
		sessions: await db.select().from(gameSession),
		entries: await db.select().from(entry),
		cash: await db.select().from(entryCash),
		tournaments: await db.select().from(entryTournament),
		plays: await db.select().from(playSession),
		cashDetails: await db.select().from(sessionCashDetail),
		tournamentDetails: await db.select().from(sessionTournamentDetail),
		chipPurchases: await db.select().from(sessionChipPurchase),
		tags: await db.select().from(sessionToSessionTag),
		ledger: await db.select().from(currencyTransaction),
		ringGames: await db.select().from(ringGame),
	};
}

async function failLastStatement(api: ApiFixture, trigger: string) {
	await api.d1
		.prepare(
			`CREATE TRIGGER test_fail_last ${trigger} BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;`
		)
		.run();
}

describe("session mutations commit all of a write or none of it on D1", () => {
	test("a create whose ledger row fails leaves no entry, anchor, detail or auto-created ring game", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const tag = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Tagged" })
		);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE INSERT ON currency_transaction");
		const failure = await api.alice.session
			.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 300,
				currencyId: wallet.id,
				tagIds: [tag.id],
			})
			.catch((error: unknown) => error);
		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("an update whose ledger row fails leaves the entry and anchored children unchanged", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const tag = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Tagged" })
		);
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "tournament",
				sessionDate: SEP_1,
				tournamentBuyIn: 1000,
				entryFee: 0,
				placement: 3,
				totalEntries: 50,
				currencyId: wallet.id,
			})
		);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE UPDATE ON currency_transaction");
		const failure = await api.alice.session
			.update({
				id: created.id,
				placement: 1,
				prizeMoney: 4000,
				memo: "Must roll back",
				tagIds: [tag.id],
			})
			.catch((error: unknown) => error);
		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("a delete whose anchor row fails keeps the entry", async ({ api }) => {
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 300,
			})
		);
		const before = await everyRow(api.db);
		await failLastStatement(api, "BEFORE DELETE ON game_session");
		const failure = await api.alice.session
			.delete({ id: created.id })
			.catch((error: unknown) => error);
		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});
});

describe("session entry ownership and pagination on D1", () => {
	test("another user's and missing entry ids uniformly return FORBIDDEN", async ({
		api,
	}) => {
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 300,
			})
		);
		for (const id of [created.id, "missing-entry"]) {
			await expect(api.bob.session.getById({ id })).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
			await expect(
				api.bob.session.update({ id, memo: "Not mine" })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(api.bob.session.delete({ id })).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		}
		expect(
			(await api.alice.session.getById({ id: created.id })).profitLoss
		).toBe(200);
	});

	test("a second page excludes another user's session tied on the sort key", async ({
		api,
	}) => {
		for (let index = 0; index < 21; index++) {
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 100,
				cashOut: 100 + index,
			});
		}
		const other = requireCreatedRow(
			await api.bob.session.create({
				type: "cash_game",
				sessionDate: SEP_1,
				buyIn: 1,
				cashOut: 2,
			})
		);
		const first = await api.alice.session.list({});
		expect(first.items).toHaveLength(20);
		const second = await api.alice.session.list({ cursor: first.nextCursor });
		expect(second.items.map((item) => item.id)).not.toContain(other.id);
		expect(second.items).toHaveLength(1);
		expect(
			new Set([...first.items, ...second.items].map((item) => item.id)).size
		).toBe(21);
	});
});
