import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("currency transaction SQL boundaries", () => {
	test("rejects valid unauthenticated transaction reads and mutations without writes", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Own type" })
		);
		const input = {
			currencyId: wallet.id,
			transactionTypeId: kind.id,
			amount: 120,
			transactedAt: "2026-09-05",
		};
		const saved = requireCreatedRow(
			await api.alice.currencyTransaction.create(input)
		);
		const before = await api.db.select().from(currencyTransaction);
		const guest = api.caller(null);
		for (const request of [
			() => guest.currencyTransaction.listByCurrency({ currencyId: wallet.id }),
			() => guest.currencyTransaction.create(input),
			() => guest.currencyTransaction.update({ id: saved.id, amount: 900 }),
			() => guest.currencyTransaction.delete({ id: saved.id }),
		]) {
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await api.db.select().from(currencyTransaction)).toEqual(before);
	});

	test("rejects foreign currency and type references, including replacement types, without writes", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const foreignWallet = requireCreatedRow(
			await api.bob.currency.create({ name: "Foreign" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Own type" })
		);
		const foreignKind = requireCreatedRow(
			await api.bob.transactionType.create({
				name: "Private type",
			})
		);
		const input = {
			currencyId: wallet.id,
			transactionTypeId: kind.id,
			amount: 120,
			transactedAt: "2026-09-05",
		};
		const saved = requireCreatedRow(
			await api.alice.currencyTransaction.create(input)
		);
		const before = await api.db.select().from(currencyTransaction);
		for (const id of [foreignWallet.id, "missing-currency"]) {
			await expect(
				api.alice.currencyTransaction.create({ ...input, currencyId: id })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.currencyTransaction.listByCurrency({ currencyId: id })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		for (const id of [foreignKind.id, "missing-type"]) {
			await expect(
				api.alice.currencyTransaction.create({
					...input,
					transactionTypeId: id,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.currencyTransaction.update({
					id: saved.id,
					amount: 900,
					transactionTypeId: id,
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		await expect(
			api.bob.currencyTransaction.update({ id: saved.id, amount: 900 })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.bob.currencyTransaction.delete({ id: saved.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.currencyTransaction.update({
				id: "missing-transaction",
				amount: 900,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.currencyTransaction.delete({ id: "missing-transaction" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await api.db.select().from(currencyTransaction)).toEqual(before);
	});

	test("uses the owning currency to authorize update and delete, and persists accepted changes", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Adjustment" })
		);
		const replacement = requireCreatedRow(
			await api.alice.transactionType.create({
				name: "Replacement",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.currencyTransaction.create({
				currencyId: wallet.id,
				transactionTypeId: kind.id,
				amount: 120,
				transactedAt: "2026-09-05",
				memo: "Original",
			})
		);
		await api.alice.currencyTransaction.update({
			id: saved.id,
			amount: -30,
			transactedAt: "2026-09-04",
			memo: null,
			transactionTypeId: replacement.id,
		});
		expect(
			await api.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.id, saved.id))
		).toEqual([
			expect.objectContaining({
				amount: -30,
				transactedAt: new Date("2026-09-04T00:00:00.000Z"),
				memo: null,
				transactionTypeId: replacement.id,
			}),
		]);
		await api.alice.currencyTransaction.delete({ id: saved.id });
		expect(
			(
				await api.alice.currencyTransaction.listByCurrency({
					currencyId: wallet.id,
				})
			).items
		).toEqual([]);
	});

	test("hides a foreign session name while retaining the transaction's own public fields", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Adjustment" })
		);
		await api.db.insert(gameSession).values({
			id: "private-session",
			userId: "bob",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: new Date("2026-09-05"),
			updatedAt: new Date("2026-09-05"),
		});
		await api.db
			.insert(sessionCashDetail)
			.values({ sessionId: "private-session", ruleName: "Secret location" });
		await api.db.insert(currencyTransaction).values({
			id: "legacy-session-link",
			currencyId: wallet.id,
			transactionTypeId: kind.id,
			sessionId: "private-session",
			amount: 10,
			transactedAt: new Date("2026-09-05"),
		});
		const result = await api.alice.currencyTransaction.listByCurrency({
			currencyId: wallet.id,
		});
		expect(result.items).toEqual([
			expect.objectContaining({
				id: "legacy-session-link",
				amount: 10,
				transactionTypeName: "Adjustment",
				sessionName: null,
			}),
		]);
	});

	test("paginates equal dates without gaps and ignores foreign or deleted cursor rows", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const foreignWallet = requireCreatedRow(
			await api.bob.currency.create({
				name: "Other account",
			})
		);
		const kind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Adjustment" })
		);
		const foreignKind = requireCreatedRow(
			await api.bob.transactionType.create({
				name: "Private adjustment",
			})
		);
		const ids = Array.from(
			{ length: 12 },
			(_, index) => `transaction-${index.toString().padStart(2, "0")}`
		);
		for (const id of ids) {
			await api.db.insert(currencyTransaction).values({
				id,
				currencyId: wallet.id,
				transactionTypeId: kind.id,
				amount: 1,
				transactedAt: new Date("2026-09-05T00:00:00.000Z"),
			});
		}
		const foreign = requireCreatedRow(
			await api.bob.currencyTransaction.create({
				currencyId: foreignWallet.id,
				transactionTypeId: foreignKind.id,
				amount: 999,
				transactedAt: "2020-01-01",
			})
		);
		const first = await api.alice.currencyTransaction.listByCurrency({
			currencyId: wallet.id,
		});
		expect(first.items.map(({ id }) => id)).toEqual(
			ids.toReversed().slice(0, 10)
		);
		expect(first.nextCursor).toBe("transaction-02");
		const second = await api.alice.currencyTransaction.listByCurrency({
			currencyId: wallet.id,
			cursor: first.nextCursor,
		});
		expect(second.items.map(({ id }) => id)).toEqual([
			"transaction-01",
			"transaction-00",
		]);
		expect(second.nextCursor).toBeUndefined();
		expect(
			await api.alice.currencyTransaction.listByCurrency({
				currencyId: wallet.id,
				cursor: foreign.id,
			})
		).toEqual(first);
		await api.db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.id, "transaction-02"));
		// Existing contract restarts from the current first page if its cursor disappeared.
		expect(
			await api.alice.currencyTransaction.listByCurrency({
				currencyId: wallet.id,
				cursor: "transaction-02",
			})
		).toEqual(
			await api.alice.currencyTransaction.listByCurrency({
				currencyId: wallet.id,
			})
		);
	});

	test("excludes transaction rows whose legacy type link belongs to another account", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Own" })
		);
		const ownKind = requireCreatedRow(
			await api.alice.transactionType.create({ name: "Visible" })
		);
		const foreignKind = requireCreatedRow(
			await api.bob.transactionType.create({
				name: "Secret type name",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.currencyTransaction.create({
				currencyId: wallet.id,
				transactionTypeId: ownKind.id,
				amount: 10,
				transactedAt: "2026-09-05",
			})
		);
		await api.db.insert(currencyTransaction).values({
			id: "legacy-cross-account",
			currencyId: wallet.id,
			transactionTypeId: foreignKind.id,
			amount: 20,
			transactedAt: new Date("2026-09-05"),
		});
		const result = await api.alice.currencyTransaction.listByCurrency({
			currencyId: wallet.id,
		});
		expect(
			result.items.map(({ id, transactionTypeName }) => ({
				id,
				transactionTypeName,
			}))
		).toEqual([{ id: saved.id, transactionTypeName: "Visible" }]);
	});
});
