import { currency, currencyTransaction } from "@sapphire2/db/schema/currency";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("currency persistence and account isolation on D1", () => {
	test("persists create, partial update, clear, favorite and delete through independent callers", async ({
		api,
	}) => {
		const created = requireCreatedRow(
			await api.alice.currency.create({
				name: "Travel",
				unit: "USD",
				description: "Trip",
			})
		);
		expect(created).toMatchObject({
			name: "Travel",
			unit: "USD",
			userId: "alice",
		});
		await api.alice.currency.update({ id: created.id, name: "Bankroll" });
		expect(await api.caller("alice").currency.list()).toEqual([
			expect.objectContaining({
				id: created.id,
				name: "Bankroll",
				unit: "USD",
				description: "Trip",
				balance: 0,
			}),
		]);
		await api.alice.currency.update({
			id: created.id,
			unit: null,
			description: null,
		});
		await api.alice.currency.toggleFavorite({ id: created.id });
		expect(
			await api.db.select().from(currency).where(eq(currency.id, created.id))
		).toEqual([
			expect.objectContaining({
				unit: null,
				description: null,
				isFavorite: true,
			}),
		]);
		expect(await api.bob.currency.list()).toEqual([]);
		await api.alice.currency.delete({ id: created.id });
		expect(await api.caller("alice").currency.list()).toEqual([]);
	});

	test("rejects valid unauthenticated reads and every currency mutation without changing stored rows", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.currency.create({ name: "Saved" })
		);
		const before = await api.db.select().from(currency);
		const guest = api.caller(null);
		const requests = [
			() => guest.currency.list(),
			() => guest.currency.create({ name: "Valid name" }),
			() => guest.currency.update({ id: saved.id, name: "Changed" }),
			() => guest.currency.toggleFavorite({ id: saved.id }),
			() => guest.currency.delete({ id: saved.id }),
		];
		for (const request of requests) {
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await api.db.select().from(currency)).toEqual(before);
	});

	test("rejects foreign and nonexistent IDs uniformly for updates, favorites and deletes", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.bob.currency.create({ name: "Private savings" })
		);
		const before = await api.db.select().from(currency);
		for (const id of [saved.id, "missing-currency"]) {
			await expect(
				api.alice.currency.update({ id, name: "Stolen" })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this currency",
			});
			await expect(
				api.alice.currency.toggleFavorite({ id })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this currency",
			});
			await expect(api.alice.currency.delete({ id })).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this currency",
			});
		}
		expect(await api.alice.currency.list()).toEqual([]);
		expect(await api.db.select().from(currency)).toEqual(before);
	});

	test("calculates balances with real joins and prevents deletion while transactions exist", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Cash" })
		);
		const empty = requireCreatedRow(
			await api.alice.currency.create({ name: "Empty" })
		);
		const bobWallet = requireCreatedRow(
			await api.bob.currency.create({ name: "Private" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Adjustment" })
		);
		const bobKind = requireCreatedRow(
			await api.bob.transactionType.create({
				name: "Private kind",
			})
		);
		const deposit = requireCreatedRow(
			await api.alice.currencyTransaction.create({
				currencyId: wallet.id,
				transactionTypeId: kind.id,
				amount: 10_000,
				transactedAt: "2026-09-05",
			})
		);
		await api.alice.currencyTransaction.create({
			currencyId: wallet.id,
			transactionTypeId: kind.id,
			amount: -2500,
			transactedAt: "2026-09-05",
		});
		await api.bob.currencyTransaction.create({
			currencyId: bobWallet.id,
			transactionTypeId: bobKind.id,
			amount: 999_999,
			transactedAt: "2026-09-05",
		});
		expect(deposit.transactedAt).toEqual(new Date("2026-09-05T00:00:00.000Z"));
		expect(
			(await api.alice.currency.list()).map(({ id, balance }) => ({
				id,
				balance,
			}))
		).toEqual(
			expect.arrayContaining([
				{ id: wallet.id, balance: 7500 },
				{ id: empty.id, balance: 0 },
			])
		);
		expect(await api.alice.currency.list()).toHaveLength(2);
		const transactionsBefore = await api.db.select().from(currencyTransaction);
		await expect(
			api.alice.currency.delete({ id: wallet.id })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await api.db.select().from(currencyTransaction)).toEqual(
			transactionsBefore
		);
		expect(
			await api.db.select().from(currency).where(eq(currency.id, wallet.id))
		).toHaveLength(1);
	});
});
