import { describe, expect } from "vitest";
import {
	type ApiFixture,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

type TournamentRole = "buy_in" | "reentry" | "fee" | "prize" | "bounty";
type CashRole = "buy_in" | "addon" | "chip_remove" | "cash_out";

interface Payment<Role extends string> {
	assetId: string;
	effect: "real" | "virtual";
	quantity: number;
	role: Role;
}

function pay<Role extends TournamentRole | CashRole>(
	role: Role,
	assetId: string,
	quantity: number,
	effect: "real" | "virtual" = "real"
): Payment<Role> {
	return { role, assetId, quantity, effect };
}

const at = (iso: string) => Date.parse(iso) / 1000;

async function rejection(promise: Promise<unknown>): Promise<unknown> {
	return await promise.then(
		() => {
			throw new Error("expected the call to fail");
		},
		(error: unknown) => error
	);
}

async function cashFixture(api: ApiFixture) {
	const jpy = requireCreatedRow(
		await api.alice.asset.create({ name: "JPY", kind: "currency" })
	);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const rule = await nlhGame(api.db);
	const tag = requireCreatedRow(
		await api.alice.entryTag.create({ name: "Home" })
	);
	const twoDays = await api.alice.entry.create({
		kind: "cash",
		playedOn: "2026-09-01",
		roomId: room.id,
		assetId: jpy.id,
		rule,
		tagIds: [tag.id],
		playSessions: [
			{
				localDate: "2026-09-01",
				startedAt: at("2026-08-31T23:00:00Z"),
				endedAt: at("2026-09-01T03:00:00Z"),
				breakMinutes: 30,
				endState: "held",
				endStack: 12_000,
				payments: [pay("buy_in", jpy.id, 10_000)],
			},
			{
				localDate: "2026-09-02",
				startedAt: at("2026-09-02T10:00:00Z"),
				endedAt: at("2026-09-02T12:00:00Z"),
				breakMinutes: 15,
				endState: "cashed_out",
				payments: [pay("cash_out", jpy.id, 13_000)],
			},
		],
	});
	const untimed = await api.alice.entry.create({
		kind: "cash",
		playedOn: "2026-09-05",
		roomId: room.id,
		assetId: jpy.id,
		rule,
		payments: [pay("buy_in", jpy.id, 5000), pay("cash_out", jpy.id, 4000)],
	});
	await api.alice.entry.create({
		kind: "cash",
		playedOn: "2026-10-01",
		assetId: jpy.id,
		rule,
		payments: [pay("buy_in", jpy.id, 1000), pay("cash_out", jpy.id, 90_000)],
	});
	await api.alice.live.create({
		kind: "cash",
		roomId: room.id,
		assetId: jpy.id,
		rule,
		startedAt: at("2026-09-03T10:00:00Z"),
		localDate: "2026-09-03",
		payments: [pay("buy_in", jpy.id, 50_000)],
	});
	const bobJpy = requireCreatedRow(
		await api.bob.asset.create({ name: "JPY", kind: "currency" })
	);
	await api.bob.entry.create({
		kind: "cash",
		playedOn: "2026-09-01",
		assetId: bobJpy.id,
		rule: await nlhGame(api.db, "bob"),
		payments: [
			pay("buy_in", bobJpy.id, 1000),
			pay("cash_out", bobJpy.id, 9000),
		],
	});
	return { jpy, room, tag, twoDays, untimed };
}

describe("stats on D1", () => {
	test("counts settled entries in the date range only, sums every timed day and buckets by playedOn", async ({
		api,
	}) => {
		const { jpy, tag, twoDays, untimed } = await cashFixture(api);
		const scope = {
			assetId: jpy.id,
			dateFrom: "2026-09-01",
			dateTo: "2026-09-30",
		};

		const summary = await api.alice.stats.summary(scope);
		expect(summary).toMatchObject({
			mode: "asset",
			assetId: jpy.id,
			entryCount: 2,
			excludedEntryCount: 0,
			multiAssetEntryCount: 0,
			amounts: { buyIn: 15_000, cashOut: 17_000, profitLoss: 2000 },
			winCount: 1,
			lossCount: 1,
			winRate: 50,
			cashEntryCount: 2,
			tournamentEntryCount: 0,
			playMinutes: 210 + 105,
			roi: null,
			normalized: null,
		});
		expect(summary.bbPerHour).toBeCloseTo(1500 / (315 / 60));

		expect(
			await api.alice.stats.summary({ ...scope, entryTagIds: [tag.id] })
		).toMatchObject({ entryCount: 1, amounts: { profitLoss: 3000 } });

		const byDay = await api.alice.stats.breakdown({
			...scope,
			groupBy: "dayOfWeek",
		});
		expect(
			byDay.groups.map(({ key, entryCount }) => ({ key, entryCount }))
		).toEqual([
			{ key: "2", entryCount: 1 },
			{ key: "6", entryCount: 1 },
		]);
		const byLength = await api.alice.stats.breakdown({
			...scope,
			groupBy: "length",
		});
		expect(byLength.groups.map(({ key }) => key)).toEqual(["4-8h", "unknown"]);
		const byMonth = await api.alice.stats.breakdown({
			assetId: jpy.id,
			dateTo: "2026-09-30",
			groupBy: "month",
		});
		expect(
			byMonth.groups.map(({ key, entryCount }) => [key, entryCount])
		).toEqual([["2026-09", 2]]);

		const series = await api.alice.stats.profitLossSeries({ normalized: true });
		expect(
			series.points.map(({ id, profitLoss, unit, playMinutes }) => ({
				id,
				profitLoss,
				unit,
				playMinutes,
			}))
		).toEqual([
			{ id: twoDays.id, profitLoss: 1500, unit: "bb", playMinutes: 315 },
			{ id: untimed.id, profitLoss: -500, unit: "bb", playMinutes: null },
			expect.objectContaining({ profitLoss: 44_500, unit: "bb" }),
		]);
	});

	test("values the section 12.1 tournaments per mode without zeroing other assets", async ({
		api,
	}) => {
		const pt = requireCreatedRow(
			await api.alice.asset.create({ name: "PT", kind: "currency" })
		);
		const ticket = requireCreatedRow(
			await api.alice.asset.create({ name: "Ticket", kind: "item" })
		);
		await api.alice.assetRate.create({
			baseAssetId: ticket.id,
			quoteAssetId: pt.id,
			rateNum: 20_000,
			rateDen: 1,
			effectiveFrom: 0,
		});
		const tournament = (payments: Payment<TournamentRole>[]) =>
			api.alice.entry.create({
				kind: "tournament",
				playedOn: "2026-09-01",
				placement: 1,
				totalEntries: 10,
				payments,
			});
		await tournament([pay("buy_in", pt.id, 3000), pay("prize", ticket.id, 1)]);
		await tournament([
			pay("buy_in", ticket.id, 1),
			pay("prize", pt.id, 45_000),
		]);
		await tournament([
			pay("buy_in", pt.id, 5000, "virtual"),
			pay("prize", pt.id, 8000),
		]);

		expect(
			await rejection(api.alice.stats.summary({ valuation: "real" }))
		).toMatchObject({ code: "PRECONDITION_FAILED" });
		await api.alice.userSetting.update({ baseAssetId: pt.id });

		const real = await api.alice.stats.summary({ valuation: "real" });
		expect(real).toMatchObject({
			mode: "valuation",
			baseAssetId: pt.id,
			entryCount: 3,
			excludedEntryCount: 0,
			amounts: { profitLoss: 50_000, buyIn: 3000 },
			itmCount: 3,
		});
		expect(real.roi).toBeCloseTo((50_000 / 3000) * 100);
		const virtual = await api.alice.stats.summary({
			valuation: "virtual",
			baseAssetId: pt.id,
		});
		expect(virtual.amounts).toMatchObject({
			profitLoss: 45_000,
			buyIn: 28_000,
		});
		expect(virtual.roi).toBeCloseTo((45_000 / 28_000) * 100);

		expect(await api.alice.stats.summary({ assetId: pt.id })).toMatchObject({
			entryCount: 3,
			multiAssetEntryCount: 2,
			otherAssetIds: [ticket.id],
			amounts: { profitLoss: -3000 + 45_000 + 8000, buyIn: 3000 },
		});

		const normalized = await api.alice.stats.summary({ normalized: true });
		expect(normalized).toMatchObject({
			amounts: null,
			roi: null,
			unavailableNormalizationEntryCount: 0,
			normalized: { cash: null, tournament: { unit: "bi", entryCount: 3 } },
		});
		expect(normalized.normalized?.tournament?.profitLoss).toBeCloseTo(
			-1 + 45_000 / 20_000 + 8000 / 5000
		);
	});

	test("normalizes a tournament by its first buy-in and fee, and excludes an entry without a rate", async ({
		api,
	}) => {
		const pt = requireCreatedRow(
			await api.alice.asset.create({ name: "PT", kind: "currency" })
		);
		const usd = requireCreatedRow(
			await api.alice.asset.create({ name: "USD", kind: "currency" })
		);
		await api.alice.userSetting.update({ baseAssetId: pt.id });
		const reentered = await api.alice.entry.create({
			kind: "tournament",
			playedOn: "2026-09-01",
			payments: [
				pay("buy_in", pt.id, 1000),
				pay("fee", pt.id, 100),
				pay("reentry", pt.id, 1000),
				pay("fee", pt.id, 100),
				pay("prize", pt.id, 5000),
			],
		});
		const unrated = await api.alice.entry.create({
			kind: "tournament",
			playedOn: "2026-09-02",
			payments: [pay("buy_in", usd.id, 10), pay("prize", usd.id, 30)],
		});

		const series = await api.alice.stats.profitLossSeries({ normalized: true });
		const point = series.points.find(
			(candidate) => candidate.id === reentered.id
		);
		expect(point).toMatchObject({ unit: "bi", buyInTotal: 1100 });
		expect(point?.profitLoss).toBeCloseTo(2800 / 1100);

		const real = await api.alice.stats.summary({ valuation: "real" });
		expect(real).toMatchObject({
			entryCount: 2,
			excludedEntryCount: 1,
			amounts: { profitLoss: 2800, buyIn: 2200 },
			tournamentEntryCount: 1,
		});
		expect(real.missingRates).toEqual([
			{ assetId: usd.id, earliestOccurredAt: expect.any(Date) },
		]);
		const valuedSeries = await api.alice.stats.profitLossSeries({
			valuation: "real",
		});
		expect(
			valuedSeries.points.find((candidate) => candidate.id === unrated.id)
				?.profitLoss
		).toBeNull();
	});

	test("rejects combined modes and foreign filter ids", async ({ api }) => {
		const { jpy } = await cashFixture(api);
		expect(
			await rejection(
				api.alice.stats.summary({ assetId: jpy.id, normalized: true })
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		const bobTag = requireCreatedRow(
			await api.bob.entryTag.create({ name: "Bob" })
		);
		expect(
			await rejection(
				api.alice.stats.summary({ normalized: true, entryTagIds: [bobTag.id] })
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(
			await rejection(api.bob.stats.summary({ assetId: jpy.id }))
		).toMatchObject({ code: "FORBIDDEN" });
	});
});
