import { entry } from "@sapphire2/db/schema/entry";
import { ledgerCategory, ledgerLine } from "@sapphire2/db/schema/ledger";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import { encodeCursor } from "../lib/cursor";
import { buildExchangeStatements } from "../services/ledger-writes";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const T0 = 1_788_000_000;
const FORBIDDEN = { code: "FORBIDDEN" };
const BAD_REQUEST = { code: "BAD_REQUEST" };

function at(seconds: number): Date {
	return new Date(seconds * 1000);
}

async function createAsset(
	caller: ApiFixture["alice"],
	name: string,
	kind: "currency" | "item" = "currency"
) {
	return requireCreatedRow(await caller.asset.create({ kind, name }));
}

async function seedEntry(
	api: ApiFixture,
	id: string,
	title: string,
	entryLines: {
		assetId: string;
		occurredAt: number;
		quantity: number;
		role: "buy_in" | "cash_out";
		effect?: "real" | "virtual";
	}[]
) {
	await api.db.insert(entry).values({
		id,
		kind: "cash",
		playedOn: "2026-09-01",
		source: "manual",
		status: "settled",
		title,
		updatedAt: NOW,
		userId: "alice",
	});
	await api.db.insert(ledgerLine).values(
		entryLines.map((line, index) => ({
			assetId: line.assetId,
			effect: line.effect ?? "real",
			entryId: id,
			id: `${id}:${index}`,
			occurredAt: at(line.occurredAt),
			quantity: line.quantity,
			role: line.role,
			updatedAt: NOW,
			userId: "alice",
		}))
	);
}

async function lines(api: ApiFixture) {
	return await api.db.select().from(ledgerLine).orderBy(asc(ledgerLine.id));
}

describe("wallet writes on D1", () => {
	test("rejects an adjustment when its asset is archived before the write", async ({
		api,
	}) => {
		const currency = await createAsset(api.alice, "Race currency");
		const raced = api.raceCaller("alice", () =>
			api.alice.asset.archive({ id: currency.id })
		);
		await expect(
			raced.ledger.createAdjustment({
				assetId: currency.id,
				occurredAt: T0,
				quantity: 100,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await lines(api)).toEqual([]);
	});

	test("an adjustment moves the balance and an exchange stores two opposite real lines of distinct assets under one transfer id, keeping epoch seconds exact", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const usd = await createAsset(api.alice, "USD");

		const deposit = await api.alice.ledger.createAdjustment({
			assetId: jpy.id,
			memo: "Opening balance",
			occurredAt: T0,
			quantity: 100_000,
		});
		expect(deposit).toEqual({
			assetId: jpy.id,
			categoryId: null,
			effect: "real",
			entryId: null,
			id: deposit?.id,
			memo: "Opening balance",
			occurredAt: at(T0),
			quantity: 100_000,
			role: "adjustment",
			transferId: null,
		});
		await api.alice.ledger.createAdjustment({
			assetId: jpy.id,
			occurredAt: T0 + 1,
			quantity: -5000,
		});

		const exchange = await api.alice.ledger.createExchange({
			from: { assetId: jpy.id, quantity: 15_000 },
			occurredAt: T0 + 59,
			to: { assetId: usd.id, quantity: 100 },
		});
		expect(exchange.lines).toEqual([
			expect.objectContaining({
				assetId: jpy.id,
				occurredAt: at(T0 + 59),
				quantity: -15_000,
				role: "exchange",
				transferId: exchange.transferId,
			}),
			expect.objectContaining({
				assetId: usd.id,
				occurredAt: at(T0 + 59),
				quantity: 100,
				role: "exchange",
				transferId: exchange.transferId,
			}),
		]);

		expect(await api.alice.asset.getById({ id: jpy.id })).toMatchObject({
			balance: 100_000 - 5000 - 15_000,
		});
		expect(await api.alice.asset.getById({ id: usd.id })).toMatchObject({
			balance: 100,
		});
		const history = await api.alice.ledger.listByAsset({ assetId: jpy.id });
		expect(
			history.items.map((item) =>
				item.kind === "wallet" ? item.line.occurredAt : null
			)
		).toEqual([at(T0 + 59), at(T0 + 1), at(T0)]);
	});

	test("an exchange whose second leg cannot be stored leaves neither leg", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const bobUsd = await createAsset(api.bob, "USD");
		const { statements } = buildExchangeStatements(
			api.db,
			"alice",
			{
				categoryId: null,
				from: { assetId: jpy.id, quantity: 15_000 },
				memo: null,
				occurredAt: NOW,
				to: { assetId: bobUsd.id, quantity: 100 },
			},
			NOW
		);
		await expect(runBatch(api.db, statements)).rejects.toThrow();
		expect(await lines(api)).toEqual([]);
	});

	test("an exchange edit shares time, memo and category across both legs, changes only the chosen leg's quantity without flipping its sign, and delete removes the pair", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const usd = await createAsset(api.alice, "USD");
		const category = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "FX" })
		);
		const exchange = await api.alice.ledger.createExchange({
			from: { assetId: jpy.id, quantity: 15_000 },
			memo: "Airport",
			occurredAt: T0,
			to: { assetId: usd.id, quantity: 100 },
		});
		const [outgoing, incoming] = exchange.lines;
		if (!(outgoing && incoming)) {
			throw new Error("Expected both exchange legs");
		}

		const edited = await api.alice.ledger.update({
			categoryId: category.id,
			id: incoming.id,
			memo: null,
			occurredAt: T0 + 3600,
			quantity: 110,
		});
		expect(edited.lines).toEqual([
			expect.objectContaining({
				categoryId: category.id,
				id: outgoing.id,
				memo: null,
				occurredAt: at(T0 + 3600),
				quantity: -15_000,
			}),
			expect.objectContaining({
				categoryId: category.id,
				id: incoming.id,
				memo: null,
				occurredAt: at(T0 + 3600),
				quantity: 110,
			}),
		]);

		const before = await lines(api);
		await expect(
			api.alice.ledger.update({ id: outgoing.id, quantity: 15_000 })
		).rejects.toMatchObject(BAD_REQUEST);
		await expect(
			api.alice.ledger.update({ id: incoming.id, quantity: -110 })
		).rejects.toMatchObject(BAD_REQUEST);
		expect(await lines(api)).toEqual(before);

		await expect(api.alice.ledger.delete({ id: outgoing.id })).resolves.toEqual(
			{ success: true }
		);
		expect(await lines(api)).toEqual([]);
	});

	test("rejects zero and out-of-range quantities and same-asset exchanges without writing", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const adjustment = requireCreatedRow(
			await api.alice.ledger.createAdjustment({
				assetId: jpy.id,
				occurredAt: T0,
				quantity: 1,
			})
		);
		const before = await lines(api);
		for (const quantity of [0, 1_000_000_000_001, -1_000_000_000_001, 1.5]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.createAdjustment({
					assetId: jpy.id,
					occurredAt: T0,
					quantity,
				})
			).rejects.toMatchObject(BAD_REQUEST);
			await expect(
				api.alice.ledger.update({ id: adjustment.id, quantity })
			).rejects.toMatchObject(BAD_REQUEST);
		}
		const usd = await createAsset(api.alice, "USD");
		for (const quantity of [0, -1, 1_000_000_000_001]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.createExchange({
					from: { assetId: jpy.id, quantity },
					occurredAt: T0,
					to: { assetId: usd.id, quantity: 1 },
				})
			).rejects.toMatchObject(BAD_REQUEST);
		}
		await expect(
			api.alice.ledger.createExchange({
				from: { assetId: jpy.id, quantity: 1 },
				occurredAt: T0,
				to: { assetId: jpy.id, quantity: 1 },
			})
		).rejects.toMatchObject(BAD_REQUEST);
		expect(await lines(api)).toEqual(before);
	});

	test("rejects out-of-range instants without writing and invalid cursor timestamps", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const invalid = 8_640_000_000_001;
		await expect(
			api.alice.ledger.createAdjustment({
				assetId: jpy.id,
				occurredAt: invalid,
				quantity: 1,
			})
		).rejects.toMatchObject(BAD_REQUEST);
		expect(await lines(api)).toEqual([]);
		for (const occurredAt of [invalid, -invalid]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.listByAsset({
					assetId: jpy.id,
					cursor: encodeCursor({ assetId: jpy.id, id: "boundary", occurredAt }),
				})
			).rejects.toMatchObject(BAD_REQUEST);
		}
	});

	test("refuses entry money, foreign and missing ids, archived new selections and anonymous callers, while the owner succeeds", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const usd = await createAsset(api.alice, "USD");
		const retired = await createAsset(api.alice, "Retired");
		await api.alice.asset.archive({ id: retired.id });
		const oldCategory = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Old" })
		);
		const bobAsset = await createAsset(api.bob, "JPY");
		const bobCategory = requireCreatedRow(
			await api.bob.ledgerCategory.create({ name: "Deposit" })
		);
		const bobLine = requireCreatedRow(
			await api.bob.ledger.createAdjustment({
				assetId: bobAsset.id,
				occurredAt: T0,
				quantity: 1,
			})
		);
		await seedEntry(api, "cash", "Friday cash", [
			{ assetId: jpy.id, occurredAt: T0, quantity: -30_000, role: "buy_in" },
		]);
		const own = requireCreatedRow(
			await api.alice.ledger.createAdjustment({
				assetId: jpy.id,
				categoryId: oldCategory.id,
				occurredAt: T0,
				quantity: 500,
			})
		);
		await api.alice.ledgerCategory.archive({ id: oldCategory.id });
		const before = await lines(api);

		for (const id of ["cash:0", bobLine.id, "missing"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.update({ id, memo: "mine" })
			).rejects.toMatchObject(FORBIDDEN);
			await expect(api.alice.ledger.delete({ id })).rejects.toMatchObject(
				FORBIDDEN
			);
		}
		for (const assetId of [bobAsset.id, "missing"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.createAdjustment({
					assetId,
					occurredAt: T0,
					quantity: 1,
				})
			).rejects.toMatchObject(FORBIDDEN);
			await expect(
				api.alice.ledger.createExchange({
					from: { assetId: jpy.id, quantity: 1 },
					occurredAt: T0,
					to: { assetId, quantity: 1 },
				})
			).rejects.toMatchObject(FORBIDDEN);
			await expect(
				api.alice.ledger.listByAsset({ assetId })
			).rejects.toMatchObject(FORBIDDEN);
		}
		for (const categoryId of [bobCategory.id, "missing"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			await expect(
				api.alice.ledger.createAdjustment({
					assetId: jpy.id,
					categoryId,
					occurredAt: T0,
					quantity: 1,
				})
			).rejects.toMatchObject(FORBIDDEN);
			await expect(
				api.alice.ledger.update({ categoryId, id: own.id })
			).rejects.toMatchObject(FORBIDDEN);
		}
		await expect(
			api.alice.ledger.createAdjustment({
				assetId: retired.id,
				occurredAt: T0,
				quantity: 1,
			})
		).rejects.toMatchObject(BAD_REQUEST);
		await expect(
			api.alice.ledger.createExchange({
				from: { assetId: retired.id, quantity: 1 },
				occurredAt: T0,
				to: { assetId: usd.id, quantity: 1 },
			})
		).rejects.toMatchObject(BAD_REQUEST);
		await expect(
			api.alice.ledger.createAdjustment({
				assetId: jpy.id,
				categoryId: oldCategory.id,
				occurredAt: T0,
				quantity: 1,
			})
		).rejects.toMatchObject(BAD_REQUEST);
		const guest = api.caller(null);
		for (const request of [
			() => guest.ledger.listByAsset({ assetId: jpy.id }),
			() =>
				guest.ledger.createAdjustment({
					assetId: jpy.id,
					occurredAt: T0,
					quantity: 1,
				}),
			() =>
				guest.ledger.createExchange({
					from: { assetId: jpy.id, quantity: 1 },
					occurredAt: T0,
					to: { assetId: usd.id, quantity: 1 },
				}),
			() => guest.ledger.update({ id: own.id, memo: "x" }),
			() => guest.ledger.delete({ id: own.id }),
			() => guest.ledgerCategory.list(),
			() => guest.ledgerCategory.create({ name: "x" }),
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep requests sequential.
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await lines(api)).toEqual(before);

		const kept = await api.alice.ledger.update({
			categoryId: oldCategory.id,
			id: own.id,
			memo: "Still the old category",
		});
		expect(kept.lines).toEqual([
			expect.objectContaining({
				categoryId: oldCategory.id,
				memo: "Still the old category",
			}),
		]);
		const cleared = await api.alice.ledger.update({
			categoryId: null,
			id: own.id,
		});
		expect(cleared.lines).toEqual([
			expect.objectContaining({
				categoryId: null,
				memo: "Still the old category",
			}),
		]);
		await expect(api.alice.ledger.delete({ id: own.id })).resolves.toEqual({
			success: true,
		});
		expect((await lines(api)).map(({ id }) => id)).toEqual(
			[bobLine.id, "cash:0"].sort()
		);
	});
});

describe("ledger.listByAsset on D1", () => {
	test("pages (occurredAt, id) descending through equal timestamps, survives deletion of the cursor row and returns only the owner's lines in that asset", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const usd = await createAsset(api.alice, "USD");
		const bobJpy = await createAsset(api.bob, "JPY");
		await api.bob.ledger.createAdjustment({
			assetId: bobJpy.id,
			occurredAt: T0,
			quantity: 7,
		});
		await api.alice.ledger.createAdjustment({
			assetId: usd.id,
			occurredAt: T0,
			quantity: 9,
		});
		const ids: string[] = [];
		for (let index = 0; index < 5; index += 1) {
			const line = requireCreatedRow(
				// biome-ignore lint/performance/noAwaitInLoops: Keep D1 writes in creation order.
				await api.alice.ledger.createAdjustment({
					assetId: jpy.id,
					occurredAt: T0,
					quantity: index + 1,
				})
			);
			ids.push(line.id);
		}
		const expected = [...ids].sort().reverse();

		const first = await api.alice.ledger.listByAsset({
			assetId: jpy.id,
			limit: 2,
		});
		const firstIds = first.items.map((item) =>
			item.kind === "wallet" ? item.line.id : item.id
		);
		expect(firstIds).toEqual(expected.slice(0, 2));
		if (first.nextCursor === null) {
			throw new Error("Expected a next page");
		}

		await api.alice.ledger.delete({ id: expected[1] as string });
		const second = await api.alice.ledger.listByAsset({
			assetId: jpy.id,
			cursor: first.nextCursor,
			limit: 2,
		});
		const third = await api.alice.ledger.listByAsset({
			assetId: jpy.id,
			cursor: second.nextCursor ?? undefined,
			limit: 2,
		});
		expect(
			[...second.items, ...third.items].map((item) =>
				item.kind === "wallet" ? item.line.id : item.id
			)
		).toEqual(expected.slice(2));
		expect(third.nextCursor).toBeNull();

		await expect(
			api.alice.ledger.listByAsset({
				assetId: usd.id,
				cursor: first.nextCursor,
			})
		).rejects.toMatchObject(FORBIDDEN);
		await expect(
			api.alice.ledger.listByAsset({ assetId: jpy.id, cursor: "not-a-cursor" })
		).rejects.toMatchObject(BAD_REQUEST);
		await expect(
			api.alice.ledger.listByAsset({
				assetId: jpy.id,
				cursor: `${first.nextCursor} `,
			})
		).rejects.toMatchObject(BAD_REQUEST);
	});

	test("totals an entry's real lines within the listed asset only, dated at its first line", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		const usd = await createAsset(api.alice, "USD");
		await seedEntry(api, "trip", "Vegas trip", [
			{
				assetId: jpy.id,
				occurredAt: T0 + 600,
				quantity: 50_000,
				role: "cash_out",
			},
			{
				assetId: jpy.id,
				occurredAt: T0 + 60,
				quantity: -30_000,
				role: "buy_in",
			},
			{
				assetId: jpy.id,
				effect: "virtual",
				occurredAt: T0,
				quantity: -9999,
				role: "buy_in",
			},
			{ assetId: usd.id, occurredAt: T0, quantity: -200, role: "buy_in" },
		]);

		expect(await api.alice.ledger.listByAsset({ assetId: jpy.id })).toEqual({
			items: [
				{
					assetId: jpy.id,
					entryId: "trip",
					id: "trip",
					kind: "entry",
					occurredAt: at(T0 + 60),
					quantity: 20_000,
					title: "Vegas trip",
				},
			],
			nextCursor: null,
		});
		expect(
			(await api.alice.ledger.listByAsset({ assetId: usd.id })).items
		).toEqual([
			expect.objectContaining({
				kind: "entry",
				occurredAt: at(T0),
				quantity: -200,
			}),
		]);
	});
});

describe("ledgerCategory on D1", () => {
	test("names are unique per user ignoring case and surrounding spaces, on create and rename", async ({
		api,
	}) => {
		const deposit = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Deposit" })
		);
		const bonus = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Bonus" })
		);
		await api.alice.ledgerCategory.archive({ id: deposit.id });
		const conflict = { code: "CONFLICT" };
		await expect(
			api.alice.ledgerCategory.create({ name: "  deposit " })
		).rejects.toMatchObject(conflict);
		await expect(
			api.alice.ledgerCategory.update({ id: bonus.id, name: "DEPOSIT" })
		).rejects.toMatchObject(conflict);
		await expect(
			api.bob.ledgerCategory.create({ name: "Deposit" })
		).resolves.toMatchObject({ name: "Deposit" });
		await expect(
			api.alice.ledgerCategory.update({ id: bonus.id, name: " BONUS " })
		).resolves.toMatchObject({ id: bonus.id, name: "BONUS" });
	});

	test("an icon is stored on create, kept when an update omits it, and cleared by null", async ({
		api,
	}) => {
		const gift = requireCreatedRow(
			await api.alice.ledgerCategory.create({ icon: "gift", name: "Bonus" })
		);
		await api.alice.ledgerCategory.update({ id: gift.id, name: "Gift" });
		expect(
			await api.db
				.select({ icon: ledgerCategory.icon, name: ledgerCategory.name })
				.from(ledgerCategory)
				.where(eq(ledgerCategory.id, gift.id))
		).toEqual([{ icon: "gift", name: "Gift" }]);
		await expect(
			api.alice.ledgerCategory.update({ icon: null, id: gift.id, name: "Gift" })
		).resolves.toMatchObject({ icon: null });
		await expect(
			api.alice.ledgerCategory.create({ icon: "Gift Box", name: "Other" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("a referenced category cannot be deleted but archives and restores with its lines kept, and list shows archived ones only on request", async ({
		api,
	}) => {
		const jpy = await createAsset(api.alice, "JPY");
		await api.db.insert(ledgerCategory).values({
			id: "migrated-type",
			name: "Purchase",
			updatedAt: NOW,
			userId: "alice",
		});
		const unused = requireCreatedRow(
			await api.alice.ledgerCategory.create({ name: "Unused" })
		);
		const line = requireCreatedRow(
			await api.alice.ledger.createAdjustment({
				assetId: jpy.id,
				categoryId: "migrated-type",
				occurredAt: T0,
				quantity: -1000,
			})
		);

		await expect(
			api.alice.ledgerCategory.delete({ id: "migrated-type" })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Category is in use; archive it instead",
		});
		await expect(
			api.alice.ledgerCategory.archive({ id: "migrated-type" })
		).resolves.toMatchObject({ archivedAt: expect.any(Date) });
		expect((await api.alice.ledgerCategory.list()).map(({ id }) => id)).toEqual(
			[unused.id]
		);
		expect(
			(await api.alice.ledgerCategory.list({ includeArchived: true })).map(
				({ id }) => id
			)
		).toEqual(["migrated-type", unused.id]);
		expect(
			await api.db
				.select({ categoryId: ledgerLine.categoryId })
				.from(ledgerLine)
				.where(eq(ledgerLine.id, line.id))
		).toEqual([{ categoryId: "migrated-type" }]);

		await expect(
			api.alice.ledgerCategory.restore({ id: "migrated-type" })
		).resolves.toMatchObject({ archivedAt: null });
		expect((await api.alice.ledgerCategory.list()).map(({ id }) => id)).toEqual(
			["migrated-type", unused.id]
		);
		await expect(
			api.alice.ledgerCategory.delete({ id: unused.id })
		).resolves.toEqual({ success: true });
		expect(
			(await api.alice.ledgerCategory.list({ includeArchived: true })).map(
				({ id }) => id
			)
		).toEqual(["migrated-type"]);
	});
});
