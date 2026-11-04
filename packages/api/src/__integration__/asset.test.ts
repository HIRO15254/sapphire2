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
	applyEntryEventChange,
	buildLiveEntryStartStatements,
} from "../services/entry-live-writes";
import { buildProjectionLineStatements } from "../services/entry-projector";
import { buildAdjustmentStatements } from "../services/ledger-writes";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

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
			{ assetId, quantity, categoryId: null, memo: null, occurredAt: NOW },
			NOW
		).statements
	);
}

async function startLiveCash(db: Database, id: string, assetId: string) {
	await runBatch(
		db,
		buildLiveEntryStartStatements(db, {
			id,
			userId: "alice",
			detail: { kind: "cash", ringGameId: null },
			assetId,
			roomId: null,
			title: null,
			memo: null,
			localDate: "2026-09-05",
			now: NOW,
			startEvent: {
				schemaVersion: 1,
				occurredAt: NOW,
				payload: { buyInAmount: 30_000 },
			},
		})
	);
	const { projection } = await applyEntryEventChange(
		db,
		"alice",
		id,
		{
			op: "append",
			events: [
				{
					type: "chips_add_remove",
					schemaVersion: 1,
					occurredAt: NOW,
					payload: { amount: 5000 },
				},
			],
		},
		NOW
	);
	await runBatch(
		db,
		buildProjectionLineStatements(
			db,
			{ entryId: id, userId: "alice" },
			projection.lines,
			NOW
		)
	);
}

async function createCurrency(api: ApiFixture, name: string) {
	return requireCreatedRow(
		await api.alice.asset.create({ name, kind: "currency" })
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
			roomId: club.id,
			name: "Cash",
			defaultAssetId: chips.id,
			rule: {
				game: { variantId: nlh.id },
				stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
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
			await api.alice.asset.create({ name: "Main ticket", kind: "item" })
		);
		const empty = await createCurrency(api, "Empty");
		const bobJpy = requireCreatedRow(
			await api.bob.asset.create({ name: "JPY", kind: "currency" })
		);
		await startLiveCash(api.db, "live", jpy.id);
		await adjust(api.db, "alice", jpy.id, 100_000);
		await adjust(api.db, "alice", ticket.id, 2);
		await adjust(api.db, "bob", bobJpy.id, 999_999);
		await api.db.insert(ledgerLine).values({
			id: "virtual-buy-in",
			userId: "alice",
			assetId: jpy.id,
			quantity: -5000,
			role: "buy_in",
			effect: "virtual",
			entryId: "live",
			occurredAt: NOW,
			updatedAt: NOW,
		});

		const [live] = await api.db
			.select({ status: entry.status })
			.from(entry)
			.where(eq(entry.id, "live"));
		expect(live).toEqual({ status: "open" });
		const balances = (await api.alice.asset.list()).map(
			({ id, kind, balance }) => ({ id, kind, balance })
		);
		expect(balances).toHaveLength(3);
		expect(balances).toEqual(
			expect.arrayContaining([
				{ id: jpy.id, kind: "currency", balance: 65_000 },
				{ id: ticket.id, kind: "item", balance: 2 },
				{ id: empty.id, kind: "currency", balance: 0 },
			])
		);
		expect(await api.alice.asset.getById({ id: jpy.id })).toMatchObject({
			balance: 65_000,
		});
		expect(await api.bob.asset.list()).toEqual([
			expect.objectContaining({ id: bobJpy.id, balance: 999_999 }),
		]);
	});
});

describe("asset references on D1", () => {
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
			quoteAssetId: quote.id,
			rateNum: 3,
			rateDen: 2,
			effectiveFrom: 0,
		});
		await api.alice.userSetting.update({ baseAssetId: setting.id });
		await startLiveCash(api.db, "live", played.id);
		const before = await storedRows(api);

		for (const referenced of [lined, base, quote, setting, played]) {
			await expect(
				api.alice.asset.delete({ id: referenced.id })
			).rejects.toMatchObject(IN_USE);
		}
		expect(await storedRows(api)).toEqual(before);

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
			quoteAssetId: kept.id,
			rateNum: 1,
			rateDen: 1,
			effectiveFrom: 0,
		});

		const archived = await api.alice.asset.archive({ id: old.id });
		expect(archived.archivedAt).toBeInstanceOf(Date);
		expect((await api.alice.asset.list()).map(({ id }) => id)).toEqual([
			kept.id,
		]);
		const everything = (
			await api.alice.asset.list({ includeArchived: true })
		).map(({ id, balance, archivedAt }) => ({
			id,
			balance,
			archived: archivedAt !== null,
		}));
		expect(everything).toHaveLength(2);
		expect(everything).toEqual(
			expect.arrayContaining([
				{ id: kept.id, balance: 0, archived: false },
				{ id: old.id, balance: 1200, archived: true },
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
			await api.alice.asset.update({ id: fresh.id, kind: "item", decimals: 2 })
		).toMatchObject({ kind: "item", decimals: 2 });

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
			api.alice.asset.update({ id: used.id, decimals: 2 })
		).rejects.toMatchObject(frozen);
		await expect(
			api.alice.asset.update({ id: used.id, kind: "item", name: "Renamed" })
		).rejects.toMatchObject(frozen);
		expect(
			await api.db.select().from(asset).where(eq(asset.id, used.id))
		).toEqual(before);

		expect(
			await api.alice.asset.update({
				id: used.id,
				kind: "currency",
				decimals: 0,
				name: "Renamed",
			})
		).toMatchObject({ name: "Renamed", kind: "currency", decimals: 0 });
	});
});

describe("asset writes on D1", () => {
	test("undoing a unit change with the previous value, null included, restores the asset", async ({
		api,
	}) => {
		const noUnit = await createCurrency(api, "No unit");
		const withUnit = requireCreatedRow(
			await api.alice.asset.create({
				name: "With unit",
				kind: "currency",
				unit: "JPY",
				description: "Cash",
				decimals: 2,
			})
		);
		for (const [created, changed] of [
			[noUnit, "pt"],
			[withUnit, null],
		] as const) {
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
			api.alice.asset.create({ name: " chips ", kind: "item" })
		).rejects.toMatchObject(conflict);
		await expect(
			api.alice.asset.update({ id: other.id, name: "CHIPS" })
		).rejects.toMatchObject(conflict);
		expect(await api.db.select().from(asset)).toEqual(before);
		requireCreatedRow(
			await api.bob.asset.create({ name: "Chips", kind: "currency" })
		);
	});
});

describe("asset rates on D1", () => {
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
					quoteAssetId,
					rateNum: effectiveFrom + 1,
					rateDen: 1,
					effectiveFrom,
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
				id: usdJpy200,
				rateNum: 201,
				rateDen: 1,
				effectiveFrom: new Date(200_000),
				memo: null,
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
			quoteAssetId: jpy.id,
			rateNum: 150,
			rateDen: 1,
			effectiveFrom: 1_700_000_000,
		};
		for (const invalid of [
			{ ...valid, quoteAssetId: usd.id },
			{ ...valid, rateNum: 0 },
			{ ...valid, rateDen: 1_000_000_000_001 },
			{ ...valid, rateNum: 1.5 },
			{ ...valid, effectiveFrom: -1 },
		]) {
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
			await api.alice.asset.create({ name: "Ticket", kind: "item" })
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
			await api.bob.asset.create({ name: "Private", kind: "currency" })
		);
		const bobQuote = requireCreatedRow(
			await api.bob.asset.create({ name: "Other", kind: "currency" })
		);
		const bobRate = await api.bob.assetRate.create({
			baseAssetId: bobAsset.id,
			quoteAssetId: bobQuote.id,
			rateNum: 1,
			rateDen: 1,
			effectiveFrom: 0,
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
						quoteAssetId: own.id,
						rateNum: 1,
						rateDen: 1,
						effectiveFrom: 0,
					}),
				() =>
					api.alice.assetRate.create({
						baseAssetId: own.id,
						quoteAssetId: id,
						rateNum: 1,
						rateDen: 1,
						effectiveFrom: 0,
					}),
				() => api.alice.userSetting.update({ baseAssetId: id }),
			];
			for (const request of requests) {
				await expect(request()).rejects.toMatchObject(FORBIDDEN);
			}
		}
		for (const id of [bobRate?.id ?? "", "missing-rate"]) {
			await expect(api.alice.assetRate.delete({ id })).rejects.toMatchObject(
				FORBIDDEN
			);
		}
		expect(await api.alice.assetRate.list()).toEqual([]);

		const guest = api.caller(null);
		const guestRequests = [
			() => guest.asset.list(),
			() => guest.asset.getById({ id: own.id }),
			() => guest.asset.create({ name: "Guest", kind: "currency" }),
			() => guest.asset.update({ id: own.id, name: "Guest" }),
			() => guest.asset.archive({ id: own.id }),
			() => guest.asset.restore({ id: own.id }),
			() => guest.asset.toggleFavorite({ id: own.id }),
			() => guest.asset.delete({ id: own.id }),
			() => guest.assetRate.list(),
			() =>
				guest.assetRate.create({
					baseAssetId: own.id,
					quoteAssetId: bobAsset.id,
					rateNum: 1,
					rateDen: 1,
					effectiveFrom: 0,
				}),
			() => guest.assetRate.delete({ id: bobRate?.id ?? "" }),
			() => guest.userSetting.get(),
			() => guest.userSetting.update({ timeZone: "UTC" }),
		];
		for (const request of guestRequests) {
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await storedRows(api)).toEqual(before);
	});
});
