import type { Database } from "@sapphire2/db";
import { asset } from "@sapphire2/db/schema/asset";
import { entry } from "@sapphire2/db/schema/entry";
import {
	assetRate,
	ledgerLine,
	userSetting,
} from "@sapphire2/db/schema/ledger";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import {
	buildLiveEntryStartStatements,
	commitEntryEventChange,
	loadEntryEventState,
} from "../services/entry-live-writes";
import { planEntryRule } from "../services/entry-rules";
import { buildAdjustmentStatements } from "../services/ledger-writes";
import {
	type ApiFixture,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const FORBIDDEN = { code: "FORBIDDEN" };
const BAD_REQUEST = { code: "BAD_REQUEST" };
const IN_USE = {
	code: "CONFLICT",
	message: "Asset is in use; archive it instead",
};

async function adjust(
	db: Database,
	userId: string,
	assetId: string,
	quantity: number
) {
	await runBatch(
		db,
		buildAdjustmentStatements(
			db,
			userId,
			{ assetId, categoryId: null, memo: null, occurredAt: NOW, quantity },
			NOW
		).statements
	);
}

async function startLiveCash(db: Database, id: string, assetId: string) {
	const rule = await planEntryRule(db, "alice", {
		kind: "cash",
		ringGameId: null,
		rule: await nlhGame(db),
	});
	await runBatch(db, rule.statements);
	await runBatch(
		db,
		buildLiveEntryStartStatements(db, {
			assetId,
			detail: {
				cashRuleId: rule.ruleVersionId,
				kind: "cash",
				ringGameId: null,
			},
			id,
			localDate: "2026-09-05",
			memo: null,
			now: NOW,
			roomId: null,
			startEvent: {
				occurredAt: NOW,
				payload: { payments: [{ assetId, quantity: 30_000, role: "buy_in" }] },
			},
			userId: "alice",
		})
	);
	const state = await loadEntryEventState(db, "alice", id);
	await commitEntryEventChange(db, {
		change: {
			events: [
				{
					occurredAt: NOW,
					payload: { amount: 5000, assetId, effect: "real" },
					type: "chips_add_remove",
				},
			],
			op: "append",
		},
		entryId: id,
		now: NOW,
		state,
		userId: "alice",
	});
}

async function createCurrency(api: ApiFixture, name: string) {
	return requireCreatedRow(
		await api.alice.asset.create({ kind: "currency", name })
	);
}

async function storedRows(api: ApiFixture) {
	return {
		assets: await api.db.select().from(asset),
		lines: await api.db.select().from(ledgerLine),
		rates: await api.db.select().from(assetRate),
		settings: await api.db.select().from(userSetting),
	};
}

describe("asset balances on D1", () => {
	test("a ring game's default asset cannot be deleted while referenced", async ({
		api,
	}) => {
		const nlh = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!nlh) {
			throw new Error("missing builtin nlh");
		}
		const chips = await createCurrency(api, "Chips");
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.alice.ringGame.create({
			defaultAssetId: chips.id,
			name: "Cash",
			roomId: club.id,
			rule: {
				game: { variantId: nlh.id },
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
			},
		});
		await expect(
			api.alice.asset.delete({ id: chips.id })
		).rejects.toMatchObject(IN_USE);
		expect(
			await api.db.select().from(asset).where(eq(asset.id, chips.id))
		).toHaveLength(1);
	});

	test("sum every real line of the asset, including an open live buy-in and item holdings, and are zero without lines", async ({
		api,
	}) => {
		const jpy = await createCurrency(api, "JPY");
		const ticket = requireCreatedRow(
			await api.alice.asset.create({ kind: "item", name: "Main ticket" })
		);
		const empty = await createCurrency(api, "Empty");
		const bobJpy = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "JPY" })
		);
		await startLiveCash(api.db, "live", jpy.id);
		await adjust(api.db, "alice", jpy.id, 100_000);
		await adjust(api.db, "alice", ticket.id, 2);
		await adjust(api.db, "bob", bobJpy.id, 999_999);
		await api.db.insert(ledgerLine).values({
			assetId: jpy.id,
			effect: "virtual",
			entryId: "live",
			id: "virtual-buy-in",
			occurredAt: NOW,
			quantity: -5000,
			role: "buy_in",
			updatedAt: NOW,
			userId: "alice",
		});

		const [live] = await api.db
			.select({ status: entry.status })
			.from(entry)
			.where(eq(entry.id, "live"));
		expect(live).toEqual({ status: "open" });
		const balances = (await api.alice.asset.list()).map(
			({ id, kind, balance }) => ({ balance, id, kind })
		);
		expect(balances).toHaveLength(3);
		expect(balances).toEqual(
			expect.arrayContaining([
				{ balance: 65_000, id: jpy.id, kind: "currency" },
				{ balance: 2, id: ticket.id, kind: "item" },
				{ balance: 0, id: empty.id, kind: "currency" },
			])
		);
		expect(await api.alice.asset.getById({ id: jpy.id })).toMatchObject({
			balance: 65_000,
		});
		expect(await api.bob.asset.list()).toEqual([
			expect.objectContaining({ balance: 999_999, id: bobJpy.id }),
		]);
	});
});

describe("asset references on D1", () => {
	test("tournament price and default references freeze and protect their assets", async ({
		api,
	}) => {
		const priced = await createCurrency(api, "Priced");
		const defaultAsset = await createCurrency(api, "Default");
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		await api.alice.tournament.create({
			defaultAssetId: defaultAsset.id,
			name: "Main",
			roomId: room.id,
			rule: {
				prices: [
					{
						amount: 1000,
						assetId: priced.id,
						chips: null,
						fee: 0,
						kind: "entry",
					},
				],
			},
		});
		for (const assetId of [priced.id, defaultAsset.id]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				api.alice.asset.delete({ id: assetId })
			).rejects.toMatchObject(IN_USE);
			await expect(
				api.alice.asset.update({ id: assetId, kind: "item" })
			).rejects.toMatchObject({ code: "CONFLICT" });
			await expect(
				api.alice.asset.update({ decimals: 2, id: assetId })
			).rejects.toMatchObject({ code: "CONFLICT" });
		}
	});

	test("delete refuses an asset any ledger line, rate, entry or setting references, pointing to archive, and keeps every reference", async ({
		api,
	}) => {
		const lined = await createCurrency(api, "Lined");
		const base = await createCurrency(api, "Base");
		const quote = await createCurrency(api, "Quote");
		const setting = await createCurrency(api, "Setting");
		const played = await createCurrency(api, "Played");
		const unused = await createCurrency(api, "Unused");
		await adjust(api.db, "alice", lined.id, 500);
		await api.alice.assetRate.create({
			baseAssetId: base.id,
			effectiveFrom: 0,
			quoteAssetId: quote.id,
			rateDen: 2,
			rateNum: 3,
		});
		await api.alice.userSetting.update({ baseAssetId: setting.id });
		await startLiveCash(api.db, "live", played.id);
		const before = await storedRows(api);

		for (const referenced of [lined, base, quote, setting, played]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				api.alice.asset.delete({ id: referenced.id })
			).rejects.toMatchObject(IN_USE);
		}
		expect(await storedRows(api)).toEqual(before);
		expect(
			Object.fromEntries(
				(await api.alice.asset.list()).map(({ isReferenced, name }) => [
					name,
					isReferenced,
				])
			)
		).toEqual({
			Base: true,
			Lined: true,
			Played: true,
			Quote: true,
			Setting: true,
			Unused: false,
		});

		expect(await api.alice.asset.delete({ id: unused.id })).toEqual({
			success: true,
		});
		expect(
			await api.db.select().from(asset).where(eq(asset.id, unused.id))
		).toEqual([]);
	});

	test("archive hides an asset from the default list without touching its balance or rates, and restore brings it back", async ({
		api,
	}) => {
		const kept = await createCurrency(api, "Kept");
		const old = await createCurrency(api, "Old");
		await adjust(api.db, "alice", old.id, 1200);
		await api.alice.assetRate.create({
			baseAssetId: old.id,
			effectiveFrom: 0,
			quoteAssetId: kept.id,
			rateDen: 1,
			rateNum: 1,
		});

		const archived = await api.alice.asset.archive({ id: old.id });
		expect(archived.archivedAt).toBeInstanceOf(Date);
		expect((await api.alice.asset.list()).map(({ id }) => id)).toEqual([
			kept.id,
		]);
		const everything = (
			await api.alice.asset.list({ includeArchived: true })
		).map(({ id, balance, archivedAt }) => ({
			archived: archivedAt !== null,
			balance,
			id,
		}));
		expect(everything).toHaveLength(2);
		expect(everything).toEqual(
			expect.arrayContaining([
				{ archived: false, balance: 0, id: kept.id },
				{ archived: true, balance: 1200, id: old.id },
			])
		);
		expect(await api.alice.assetRate.list()).toHaveLength(1);

		expect(await api.alice.asset.restore({ id: old.id })).toMatchObject({
			archivedAt: null,
			balance: 1200,
		});
		expect((await api.alice.asset.list()).map(({ id }) => id).sort()).toEqual(
			[kept.id, old.id].sort()
		);
	});

	test("kind and decimals change only while nothing references the asset", async ({
		api,
	}) => {
		const fresh = await createCurrency(api, "Fresh");
		expect(
			await api.alice.asset.update({ decimals: 2, id: fresh.id, kind: "item" })
		).toMatchObject({ decimals: 2, kind: "item" });

		const used = await createCurrency(api, "Used");
		await adjust(api.db, "alice", used.id, 100);
		const before = await api.db
			.select()
			.from(asset)
			.where(eq(asset.id, used.id));
		const frozen = {
			code: "CONFLICT",
			message: "Asset is in use, so its kind and decimals can no longer change",
		};
		await expect(
			api.alice.asset.update({ decimals: 2, id: used.id })
		).rejects.toMatchObject(frozen);
		await expect(
			api.alice.asset.update({ id: used.id, kind: "item", name: "Renamed" })
		).rejects.toMatchObject(frozen);
		expect(
			await api.db.select().from(asset).where(eq(asset.id, used.id))
		).toEqual(before);

		expect(
			await api.alice.asset.update({
				decimals: 0,
				id: used.id,
				kind: "currency",
				name: "Renamed",
			})
		).toMatchObject({ decimals: 0, kind: "currency", name: "Renamed" });
	});
});

describe("asset writes on D1", () => {
	test("concurrent favorite toggles both take effect", async ({ api }) => {
		const created = await createCurrency(api, "Favorite");
		await Promise.all([
			api.alice.asset.toggleFavorite({ id: created.id }),
			api.alice.asset.toggleFavorite({ id: created.id }),
		]);
		expect(await api.alice.asset.getById({ id: created.id })).toMatchObject({
			isFavorite: false,
		});
	});

	test("undoing a unit change with the previous value, null included, restores the asset", async ({
		api,
	}) => {
		const noUnit = await createCurrency(api, "No unit");
		const withUnit = requireCreatedRow(
			await api.alice.asset.create({
				decimals: 2,
				description: "Cash",
				kind: "currency",
				name: "With unit",
				unit: "JPY",
			})
		);
		for (const [created, changed] of [
			[noUnit, "pt"],
			[withUnit, null],
		] as const) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			const before = await api.alice.asset.getById({ id: created.id });
			await api.alice.asset.update({ id: created.id, unit: changed });
			await api.alice.asset.update({ id: created.id, unit: before.unit });
			expect(await api.alice.asset.getById({ id: created.id })).toEqual({
				...before,
				updatedAt: expect.any(Date),
			});
		}
	});

	test("names are unique per user after trimming and ignoring case", async ({
		api,
	}) => {
		await createCurrency(api, "Chips");
		const other = await createCurrency(api, "Points");
		const before = await api.db.select().from(asset);
		const conflict = {
			code: "CONFLICT",
			message: "You already have an asset with this name",
		};
		await expect(
			api.alice.asset.create({ kind: "item", name: " chips " })
		).rejects.toMatchObject(conflict);
		await expect(
			api.alice.asset.update({ id: other.id, name: "CHIPS" })
		).rejects.toMatchObject(conflict);
		expect(await api.db.select().from(asset)).toEqual(before);
		requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Chips" })
		);
	});
});

describe("asset rates on D1", () => {
	test("rates require active assets, including at commit time", async ({
		api,
	}) => {
		const base = await createCurrency(api, "Base");
		const quote = await createCurrency(api, "Quote");
		const input = {
			baseAssetId: base.id,
			effectiveFrom: 100,
			quoteAssetId: quote.id,
			rateDen: 1,
			rateNum: 1,
		};
		const created = requireCreatedRow(await api.alice.assetRate.create(input));
		await api.alice.asset.archive({ id: base.id });
		await expect(
			api.alice.assetRate.create({ ...input, effectiveFrom: 101 })
		).rejects.toMatchObject(BAD_REQUEST);
		await api.alice.asset.restore({ id: base.id });
		await api.alice.asset.archive({ id: quote.id });
		await expect(
			api.alice.assetRate.create({ ...input, effectiveFrom: 102 })
		).rejects.toMatchObject(BAD_REQUEST);
		await api.alice.assetRate.delete({ id: created.id });
		await api.alice.asset.restore({ id: quote.id });
		const raced = api.raceCaller("alice", () =>
			api.alice.asset.archive({ id: quote.id })
		);
		await expect(
			raced.assetRate.create({ ...input, effectiveFrom: 103 })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await api.alice.assetRate.list()).toHaveLength(0);
	});

	test("create stores initial rates from the start with the asset, and refuses a foreign or archived currency without creating anything", async ({
		api,
	}) => {
		const jpy = await createCurrency(api, "JPY");
		const usd = await createCurrency(api, "USD");
		const created = requireCreatedRow(
			await api.alice.asset.create({
				initialRates: [
					{ quoteAssetId: jpy.id, rateDen: 10, rateNum: 1 },
					{ quoteAssetId: usd.id, rateDen: 1000, rateNum: 1 },
				],
				kind: "currency",
				name: "Chips",
			})
		);
		expect(
			(await api.alice.assetRate.list({ baseAssetId: created.id }))
				.map(({ effectiveFrom, quoteAssetId, rateDen, rateNum }) => ({
					effectiveFrom,
					quoteAssetId,
					rateDen,
					rateNum,
				}))
				.sort((a, b) => a.rateDen - b.rateDen)
		).toEqual([
			{
				effectiveFrom: new Date(0),
				quoteAssetId: jpy.id,
				rateDen: 10,
				rateNum: 1,
			},
			{
				effectiveFrom: new Date(0),
				quoteAssetId: usd.id,
				rateDen: 1000,
				rateNum: 1,
			},
		]);

		const bobCurrency = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Bob coin" })
		);
		await api.alice.asset.archive({ id: usd.id });
		const before = await storedRows(api);
		await expect(
			api.alice.asset.create({
				initialRates: [
					{ quoteAssetId: bobCurrency.id, rateDen: 1, rateNum: 1 },
				],
				kind: "currency",
				name: "Foreign",
			})
		).rejects.toMatchObject(FORBIDDEN);
		await expect(
			api.alice.asset.create({
				initialRates: [{ quoteAssetId: usd.id, rateDen: 1, rateNum: 1 }],
				kind: "currency",
				name: "Archived",
			})
		).rejects.toMatchObject(BAD_REQUEST);
		expect(await storedRows(api)).toEqual(before);
	});

	test("list returns the history, or the latest rate at or before effectiveAt for each directed pair", async ({
		api,
	}) => {
		const usd = await createCurrency(api, "USD");
		const jpy = await createCurrency(api, "JPY");
		const eur = await createCurrency(api, "EUR");
		const rate = async (
			baseAssetId: string,
			quoteAssetId: string,
			effectiveFrom: number
		) =>
			(
				await api.alice.assetRate.create({
					baseAssetId,
					effectiveFrom,
					quoteAssetId,
					rateDen: 1,
					rateNum: effectiveFrom + 1,
				})
			)?.id;
		const usdJpy0 = await rate(usd.id, jpy.id, 0);
		const usdJpy100 = await rate(usd.id, jpy.id, 100);
		const usdJpy200 = await rate(usd.id, jpy.id, 200);
		const jpyUsd150 = await rate(jpy.id, usd.id, 150);
		const usdEur300 = await rate(usd.id, eur.id, 300);
		const ids = async (input: Parameters<typeof api.alice.assetRate.list>[0]) =>
			(await api.alice.assetRate.list(input)).map(({ id }) => id).sort();

		expect(
			await api.alice.assetRate.list({
				baseAssetId: usd.id,
				quoteAssetId: jpy.id,
			})
		).toEqual([
			expect.objectContaining({
				effectiveFrom: new Date(200_000),
				id: usdJpy200,
				memo: null,
				rateDen: 1,
				rateNum: 201,
			}),
			expect.objectContaining({ id: usdJpy100 }),
			expect.objectContaining({ id: usdJpy0 }),
		]);
		expect(await ids(undefined)).toEqual(
			[usdJpy0, usdJpy100, usdJpy200, jpyUsd150, usdEur300].sort()
		);
		expect(await ids({ effectiveAt: 0 })).toEqual([usdJpy0]);
		expect(await ids({ effectiveAt: 99 })).toEqual([usdJpy0]);
		expect(await ids({ effectiveAt: 100 })).toEqual([usdJpy100]);
		expect(await ids({ effectiveAt: 199 })).toEqual(
			[usdJpy100, jpyUsd150].sort()
		);
		expect(await ids({ effectiveAt: 300 })).toEqual(
			[usdJpy200, jpyUsd150, usdEur300].sort()
		);
		expect(await ids({ effectiveAt: 300, quoteAssetId: usd.id })).toEqual([
			jpyUsd150,
		]);
	});

	test("create rejects one asset on both sides and out-of-range terms, and keeps one of two concurrent rates for the same pair and instant", async ({
		api,
	}) => {
		const usd = await createCurrency(api, "USD");
		const jpy = await createCurrency(api, "JPY");
		const valid = {
			baseAssetId: usd.id,
			effectiveFrom: 1_700_000_000,
			quoteAssetId: jpy.id,
			rateDen: 1,
			rateNum: 150,
		};
		for (const invalid of [
			{ ...valid, quoteAssetId: usd.id },
			{ ...valid, rateNum: 0 },
			{ ...valid, rateDen: 1_000_000_000_001 },
			{ ...valid, rateNum: 1.5 },
			{ ...valid, effectiveFrom: -1 },
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(api.alice.assetRate.create(invalid)).rejects.toMatchObject(
				BAD_REQUEST
			);
		}

		const results = await Promise.allSettled([
			api.alice.assetRate.create(valid),
			api.alice.assetRate.create({ ...valid, rateNum: 151 }),
		]);
		expect(results.map(({ status }) => status).sort()).toEqual([
			"fulfilled",
			"rejected",
		]);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected?.reason).toMatchObject({ code: "CONFLICT" });
		const stored = await api.db.select().from(assetRate);
		expect(stored).toHaveLength(1);

		const [saved] = stored;
		await api.alice.assetRate.delete({ id: saved?.id ?? "" });
		expect(
			await api.alice.assetRate.create({ ...valid, rateNum: 152 })
		).toMatchObject({ rateNum: 152 });
	});
});

describe("user settings on D1", () => {
	test("default to nulls, keep omitted fields, clear with null and accept only an owned active currency and an IANA zone", async ({
		api,
	}) => {
		const jpy = await createCurrency(api, "JPY");
		const usd = await createCurrency(api, "USD");
		const ticket = requireCreatedRow(
			await api.alice.asset.create({ kind: "item", name: "Ticket" })
		);
		expect(await api.alice.userSetting.get()).toEqual({
			baseAssetId: null,
			timeZone: null,
		});
		expect(
			await api.alice.userSetting.update({ timeZone: "America/New_York" })
		).toEqual({ baseAssetId: null, timeZone: "America/New_York" });
		expect(await api.alice.userSetting.update({ baseAssetId: jpy.id })).toEqual(
			{ baseAssetId: jpy.id, timeZone: "America/New_York" }
		);
		expect(await api.alice.userSetting.update({ timeZone: null })).toEqual({
			baseAssetId: jpy.id,
			timeZone: null,
		});
		expect(await api.bob.userSetting.get()).toEqual({
			baseAssetId: null,
			timeZone: null,
		});

		for (const timeZone of ["Mars/Olympus", "+09:00", "", "Asia/Tokyo "]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(
				api.alice.userSetting.update({ timeZone })
			).rejects.toMatchObject(BAD_REQUEST);
		}
		await expect(
			api.alice.userSetting.update({ baseAssetId: ticket.id })
		).rejects.toMatchObject(BAD_REQUEST);
		await api.alice.asset.archive({ id: usd.id });
		await expect(
			api.alice.userSetting.update({ baseAssetId: usd.id })
		).rejects.toMatchObject(BAD_REQUEST);
		await api.alice.asset.archive({ id: jpy.id });
		expect(
			await api.alice.userSetting.update({
				baseAssetId: jpy.id,
				timeZone: "Asia/Tokyo",
			})
		).toEqual({ baseAssetId: jpy.id, timeZone: "Asia/Tokyo" });
		expect(await api.alice.userSetting.update({ baseAssetId: null })).toEqual({
			baseAssetId: null,
			timeZone: "Asia/Tokyo",
		});
	});
});

describe("asset, rate and setting ownership on D1", () => {
	test("foreign and missing ids are uniformly forbidden and unauthenticated calls are rejected, without writing", async ({
		api,
	}) => {
		const own = await createCurrency(api, "Own");
		const bobAsset = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Private" })
		);
		const bobQuote = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Other" })
		);
		const bobRate = await api.bob.assetRate.create({
			baseAssetId: bobAsset.id,
			effectiveFrom: 0,
			quoteAssetId: bobQuote.id,
			rateDen: 1,
			rateNum: 1,
		});
		const before = await storedRows(api);

		for (const id of [bobAsset.id, "missing-asset"]) {
			const requests = [
				() => api.alice.asset.getById({ id }),
				() => api.alice.asset.update({ id, unit: "x" }),
				() => api.alice.asset.archive({ id }),
				() => api.alice.asset.restore({ id }),
				() => api.alice.asset.toggleFavorite({ id }),
				() => api.alice.asset.delete({ id }),
				() => api.alice.assetRate.list({ baseAssetId: id }),
				() => api.alice.assetRate.list({ quoteAssetId: id }),
				() =>
					api.alice.assetRate.create({
						baseAssetId: id,
						effectiveFrom: 0,
						quoteAssetId: own.id,
						rateDen: 1,
						rateNum: 1,
					}),
				() =>
					api.alice.assetRate.create({
						baseAssetId: own.id,
						effectiveFrom: 0,
						quoteAssetId: id,
						rateDen: 1,
						rateNum: 1,
					}),
				() => api.alice.userSetting.update({ baseAssetId: id }),
			];
			for (const request of requests) {
				// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
				await expect(request()).rejects.toMatchObject(FORBIDDEN);
			}
		}
		for (const id of [bobRate?.id ?? "", "missing-rate"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(api.alice.assetRate.delete({ id })).rejects.toMatchObject(
				FORBIDDEN
			);
		}
		expect(await api.alice.assetRate.list()).toEqual([]);

		const guest = api.caller(null);
		const guestRequests = [
			() => guest.asset.list(),
			() => guest.asset.getById({ id: own.id }),
			() => guest.asset.create({ kind: "currency", name: "Guest" }),
			() => guest.asset.update({ id: own.id, name: "Guest" }),
			() => guest.asset.archive({ id: own.id }),
			() => guest.asset.restore({ id: own.id }),
			() => guest.asset.toggleFavorite({ id: own.id }),
			() => guest.asset.delete({ id: own.id }),
			() => guest.assetRate.list(),
			() =>
				guest.assetRate.create({
					baseAssetId: own.id,
					effectiveFrom: 0,
					quoteAssetId: bobAsset.id,
					rateDen: 1,
					rateNum: 1,
				}),
			() => guest.assetRate.delete({ id: bobRate?.id ?? "" }),
			() => guest.userSetting.get(),
			() => guest.userSetting.update({ timeZone: "UTC" }),
		];
		for (const request of guestRequests) {
			// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database operations and assertion order.
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await storedRows(api)).toEqual(before);
	});
});
