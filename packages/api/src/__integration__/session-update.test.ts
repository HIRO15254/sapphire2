import type { Database } from "@sapphire2/db";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionToSessionTag } from "@sapphire2/db/schema/session-tag";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const SESSION_DATE = Date.UTC(2026, 8, 1) / 1000;
const OTHER_DATE = Date.UTC(2026, 8, 2) / 1000;
const STALE_UPDATED_AT = new Date("2026-01-01T00:00:00.000Z");

async function storedSession(db: Database, sessionId: string) {
	return {
		session: await db
			.select()
			.from(gameSession)
			.where(eq(gameSession.id, sessionId)),
		cashDetail: await db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, sessionId)),
		ledger: await db
			.select()
			.from(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId)),
		tags: await db
			.select()
			.from(sessionToSessionTag)
			.where(eq(sessionToSessionTag.sessionId, sessionId)),
	};
}

async function ledgerOf(db: Database, sessionId: string) {
	return (
		await db
			.select({
				amount: currencyTransaction.amount,
				currencyId: currencyTransaction.currencyId,
			})
			.from(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId))
	).sort((left, right) => left.currencyId.localeCompare(right.currencyId));
}

describe("session.update commits all of an update or none of it on D1", () => {
	test("a cash rule rejected after the other fields were accepted saves none of them", async ({
		api,
	}) => {
		await api.alice.gameVariant.list();
		const walletA = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet A" })
		);
		const walletB = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet B" })
		);
		const kept = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Kept" })
		);
		const swapped = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Swapped" })
		);
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SESSION_DATE,
				buyIn: 100,
				cashOut: 300,
				currencyId: walletA.id,
				memo: "before",
				tagIds: [kept.id],
			})
		);
		await api.db
			.update(gameSession)
			.set({ updatedAt: STALE_UPDATED_AT })
			.where(eq(gameSession.id, created.id));
		const before = await storedSession(api.db, created.id);

		const rejectedRules = [
			{
				rule: {
					variant: "mix",
					mixGames: [{ variants: ["NL Hold'em", "Razz"] }],
				},
				message: "must share a game group",
			},
			{
				rule: {
					variant: "mix",
					mixGames: [{ variants: ["Not a saved game", "Razz"] }],
				},
				message: "unavailable game master",
			},
			{
				rule: {
					variant: "NL Hold'em",
					mixGames: [{ variants: ["NL Hold'em", "Pot Limit Omaha"] }],
				},
				message: "can only be used with a mixed-game variant",
			},
			{
				rule: { variant: "mix", mixGames: null },
				message: "requires mixGames",
			},
		];
		for (const { rule, message } of rejectedRules) {
			await expect(
				api.alice.session.update({
					id: created.id,
					memo: "after",
					sessionDate: OTHER_DATE,
					buyIn: 999,
					currencyId: walletB.id,
					tagIds: [swapped.id],
					...rule,
				})
			).rejects.toMatchObject({
				code: "BAD_REQUEST",
				message: expect.stringContaining(message),
			});
		}

		expect(await storedSession(api.db, created.id)).toEqual(before);
		expect(before.session[0]?.updatedAt).toEqual(STALE_UPDATED_AT);
	});

	test("an accepted cash update moves the ledger with the session it belongs to", async ({
		api,
	}) => {
		const walletA = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet A" })
		);
		const walletB = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet B" })
		);
		const kept = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Kept" })
		);
		const swapped = requireCreatedRow(
			await api.alice.sessionTag.create({ name: "Swapped" })
		);
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "cash_game",
				sessionDate: SESSION_DATE,
				buyIn: 100,
				cashOut: 300,
				currencyId: walletA.id,
				memo: "before",
				tagIds: [kept.id],
			})
		);

		await api.alice.session.update({
			id: created.id,
			memo: "after",
			buyIn: 150,
			cashOut: 500,
			tagIds: [swapped.id],
		});
		const stored = await storedSession(api.db, created.id);
		expect(stored.session[0]?.memo).toBe("after");
		expect(stored.cashDetail[0]).toMatchObject({ buyIn: 150, cashOut: 500 });
		expect(stored.tags.map((row) => row.sessionTagId)).toEqual([swapped.id]);
		expect(await ledgerOf(api.db, created.id)).toEqual([
			{ amount: 350, currencyId: walletA.id },
		]);

		await api.alice.session.update({ id: created.id, currencyId: walletB.id });
		expect(await ledgerOf(api.db, created.id)).toEqual([
			{ amount: 350, currencyId: walletB.id },
		]);

		await api.alice.session.update({ id: created.id, currencyId: null });
		expect(await ledgerOf(api.db, created.id)).toEqual([]);
	});

	test("an accepted tournament update books the chip purchases it leaves on the session", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Wallet" })
		);
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const master = requireCreatedRow(
			await api.alice.tournament.createWithLevels({
				roomId: room.id,
				name: "Deepstack",
				buyIn: 1000,
				entryFee: 100,
				chipPurchases: [{ name: "Rebuy", cost: 500, chips: 10_000 }],
			})
		);
		const created = requireCreatedRow(
			await api.alice.session.create({
				type: "tournament",
				sessionDate: SESSION_DATE,
				tournamentBuyIn: 2000,
				entryFee: 200,
				prizeMoney: 5000,
				currencyId: wallet.id,
				chipPurchases: [{ name: "Add-on", cost: 300, chips: 5000, count: 2 }],
			})
		);

		await api.alice.session.update({ id: created.id, prizeMoney: 6000 });
		expect(await ledgerOf(api.db, created.id)).toEqual([
			{ amount: 6000 - 2200 - 600, currencyId: wallet.id },
		]);

		await api.alice.session.update({
			id: created.id,
			chipPurchases: [{ name: "Add-on", cost: 300, chips: 5000, count: 3 }],
		});
		expect(await ledgerOf(api.db, created.id)).toEqual([
			{ amount: 6000 - 2200 - 900, currencyId: wallet.id },
		]);

		await api.alice.session.update({
			id: created.id,
			tournamentId: master.id,
		});
		const purchases = await api.db
			.select({ name: sessionChipPurchase.name })
			.from(sessionChipPurchase)
			.where(eq(sessionChipPurchase.sessionId, created.id));
		expect(purchases).toEqual([{ name: "Rebuy" }]);
		expect(await ledgerOf(api.db, created.id)).toEqual([
			{ amount: 6000 - 1100, currencyId: wallet.id },
		]);
	});
});
