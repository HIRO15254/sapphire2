import type { HandDetail } from "@sapphire2/db/constants/hand";
import { hand } from "@sapphire2/db/schema/hand";
import { describe, expect } from "vitest";
import type z from "zod";
import type { entryCreateCashInputSchema } from "../routers/entry";
import {
	type ApiFixture,
	nlhGame,
	requireCreatedRow,
	test,
} from "./test-fixture";

type CashInput = z.input<typeof entryCreateCashInputSchema>;

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
	return { assetId, effect, quantity, role };
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
		await api.alice.asset.create({ kind: "currency", name: "JPY" })
	);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const rule = await nlhGame(api.db);
	const tag = requireCreatedRow(
		await api.alice.entryTag.create({ name: "Home" })
	);
	const twoDays = await api.alice.entry.create({
		assetId: jpy.id,
		kind: "cash",
		playedOn: "2026-09-01",
		playSessions: [
			{
				breakMinutes: 30,
				endedAt: at("2026-09-01T03:00:00Z"),
				endStack: 12_000,
				endState: "held",
				localDate: "2026-09-01",
				payments: [pay("buy_in", jpy.id, 10_000)],
				startedAt: at("2026-08-31T23:00:00Z"),
			},
			{
				breakMinutes: 15,
				endedAt: at("2026-09-02T12:00:00Z"),
				endState: "cashed_out",
				localDate: "2026-09-02",
				payments: [pay("cash_out", jpy.id, 13_000)],
				startedAt: at("2026-09-02T10:00:00Z"),
			},
		],
		roomId: room.id,
		rule,
		tagIds: [tag.id],
	});
	const untimed = await api.alice.entry.create({
		assetId: jpy.id,
		kind: "cash",
		payments: [pay("buy_in", jpy.id, 5000), pay("cash_out", jpy.id, 4000)],
		playedOn: "2026-09-05",
		roomId: room.id,
		rule,
	});
	await api.alice.entry.create({
		assetId: jpy.id,
		kind: "cash",
		payments: [pay("buy_in", jpy.id, 1000), pay("cash_out", jpy.id, 90_000)],
		playedOn: "2026-10-01",
		rule,
	});
	await api.alice.live.create({
		assetId: jpy.id,
		kind: "cash",
		localDate: "2026-09-03",
		payments: [pay("buy_in", jpy.id, 50_000)],
		roomId: room.id,
		rule,
		startedAt: at("2026-09-03T10:00:00Z"),
	});
	const bobJpy = requireCreatedRow(
		await api.bob.asset.create({ kind: "currency", name: "JPY" })
	);
	await api.bob.entry.create({
		assetId: bobJpy.id,
		kind: "cash",
		payments: [
			pay("buy_in", bobJpy.id, 1000),
			pay("cash_out", bobJpy.id, 9000),
		],
		playedOn: "2026-09-01",
		rule: await nlhGame(api.db, "bob"),
	});
	return { jpy, room, tag, twoDays, untimed };
}

async function insertHands(
	api: ApiFixture,
	playSessionId: string | undefined,
	details: HandDetail[]
) {
	if (!playSessionId) {
		throw new Error("missing play session");
	}
	await api.db.insert(hand).values(
		details.map((detail, index) => ({
			detail,
			handNo: index + 1,
			id: `${playSessionId}-hand-${index + 1}`,
			playSessionId,
			seq: index + 1,
			updatedAt: new Date(),
			userId: "alice",
		}))
	);
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
			amounts: { buyIn: 15_000, cashOut: 17_000, profitLoss: 2000 },
			assetId: jpy.id,
			cashEntryCount: 2,
			entryCount: 2,
			excludedEntryCount: 0,
			lossCount: 1,
			mode: "asset",
			multiAssetEntryCount: 0,
			normalized: null,
			playMinutes: 210 + 105,
			roi: null,
			tournamentEntryCount: 0,
			winCount: 1,
			winRate: 50,
		});
		expect(summary.bbPerHour).toBeCloseTo(1500 / (315 / 60));

		expect(
			await api.alice.stats.summary({ ...scope, entryTagIds: [tag.id] })
		).toMatchObject({ amounts: { profitLoss: 3000 }, entryCount: 1 });

		const byDay = await api.alice.stats.breakdown({
			...scope,
			groupBy: "dayOfWeek",
		});
		expect(
			byDay.groups.map(({ key, entryCount }) => ({ entryCount, key }))
		).toEqual([
			{ entryCount: 1, key: "2" },
			{ entryCount: 1, key: "6" },
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
				playMinutes,
				profitLoss,
				unit,
			}))
		).toEqual([
			{ id: twoDays.id, playMinutes: 315, profitLoss: 1500, unit: "bb" },
			{ id: untimed.id, playMinutes: null, profitLoss: -500, unit: "bb" },
			expect.objectContaining({ profitLoss: 44_500, unit: "bb" }),
		]);
	});

	test("values the section 12.1 tournaments per mode without zeroing other assets", async ({
		api,
	}) => {
		const pt = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "PT" })
		);
		const ticket = requireCreatedRow(
			await api.alice.asset.create({ kind: "item", name: "Ticket" })
		);
		await api.alice.assetRate.create({
			baseAssetId: ticket.id,
			effectiveFrom: 0,
			quoteAssetId: pt.id,
			rateDen: 1,
			rateNum: 20_000,
		});
		const tournament = (payments: Payment<TournamentRole>[]) =>
			api.alice.entry.create({
				kind: "tournament",
				payments,
				placement: 1,
				playedOn: "2026-09-01",
				totalEntries: 10,
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
			amounts: { buyIn: 3000, profitLoss: 50_000 },
			baseAssetId: pt.id,
			entryCount: 3,
			excludedEntryCount: 0,
			itmCount: 3,
			mode: "valuation",
		});
		expect(real.roi).toBeCloseTo((50_000 / 3000) * 100);
		const virtual = await api.alice.stats.summary({
			baseAssetId: pt.id,
			valuation: "virtual",
		});
		expect(virtual.amounts).toMatchObject({
			buyIn: 28_000,
			profitLoss: 45_000,
		});
		expect(virtual.roi).toBeCloseTo((45_000 / 28_000) * 100);

		expect(await api.alice.stats.summary({ assetId: pt.id })).toMatchObject({
			amounts: { buyIn: 3000, profitLoss: -3000 + 45_000 + 8000 },
			entryCount: 3,
			multiAssetEntryCount: 2,
			otherAssetIds: [ticket.id],
		});

		const normalized = await api.alice.stats.summary({ normalized: true });
		expect(normalized).toMatchObject({
			amounts: null,
			normalized: { cash: null, tournament: { entryCount: 3, unit: "bi" } },
			roi: null,
			unavailableNormalizationEntryCount: 0,
		});
		expect(normalized.normalized?.tournament?.profitLoss).toBeCloseTo(
			-1 + 45_000 / 20_000 + 8000 / 5000
		);
	});

	test("normalizes a tournament by its first buy-in and fee, and excludes an entry without a rate", async ({
		api,
	}) => {
		const pt = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "PT" })
		);
		const usd = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "USD" })
		);
		await api.alice.userSetting.update({ baseAssetId: pt.id });
		const reentered = await api.alice.entry.create({
			kind: "tournament",
			payments: [
				pay("buy_in", pt.id, 1000),
				pay("fee", pt.id, 100),
				pay("reentry", pt.id, 1000),
				pay("fee", pt.id, 100),
				pay("prize", pt.id, 5000),
			],
			playedOn: "2026-09-01",
		});
		const unrated = await api.alice.entry.create({
			kind: "tournament",
			payments: [pay("buy_in", usd.id, 10), pay("prize", usd.id, 30)],
			playedOn: "2026-09-02",
		});

		const series = await api.alice.stats.profitLossSeries({ normalized: true });
		const point = series.points.find(
			(candidate) => candidate.id === reentered.id
		);
		expect(point).toMatchObject({ buyInTotal: 1100, unit: "bi" });
		expect(point?.profitLoss).toBeCloseTo(2800 / 1100);

		const real = await api.alice.stats.summary({ valuation: "real" });
		expect(real).toMatchObject({
			amounts: { buyIn: 2200, profitLoss: 2800 },
			entryCount: 2,
			excludedEntryCount: 1,
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

	test("includes an unpriced fee paired with a priced initial buy-in", async ({
		api,
	}) => {
		const asset = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Chips" })
		);
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		const tournament = await api.alice.tournament.create({
			name: "Main",
			roomId: room.id,
			rule: {
				prices: [
					{
						amount: 1000,
						assetId: asset.id,
						chips: 10_000,
						fee: 100,
						kind: "entry",
					},
				],
			},
		});
		const master = await api.alice.tournament.getById({ id: tournament.id });
		const priceId = master.ruleVersion.prices[0]?.id ?? "";
		const entry = await api.alice.entry.create({
			kind: "tournament",
			payments: [
				{ ...pay("buy_in", asset.id, 1000), priceId },
				pay("fee", asset.id, 100),
				pay("prize", asset.id, 2200),
			],
			playedOn: "2026-09-01",
			tournamentId: tournament.id,
		});
		const series = await api.alice.stats.profitLossSeries({ normalized: true });
		expect(series.points.find((point) => point.id === entry.id)).toMatchObject({
			buyInTotal: 1100,
			profitLoss: 1,
		});
	});

	test("converts an item-only initial payment before reporting its BI unit", async ({
		api,
	}) => {
		const currency = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Points" })
		);
		const ticket = requireCreatedRow(
			await api.alice.asset.create({ kind: "item", name: "Ticket" })
		);
		const entry = await api.alice.entry.create({
			kind: "tournament",
			payments: [pay("buy_in", ticket.id, 1)],
			playedOn: "2026-09-01",
		});
		await api.alice.userSetting.update({ baseAssetId: currency.id });
		const missing = await api.alice.stats.profitLossSeries({
			normalized: true,
		});
		expect(missing.points.find((point) => point.id === entry.id)).toMatchObject(
			{
				buyInTotal: null,
				profitLoss: null,
			}
		);
		await api.alice.assetRate.create({
			baseAssetId: ticket.id,
			effectiveFrom: 0,
			quoteAssetId: currency.id,
			rateDen: 1,
			rateNum: 20_000,
		});
		const valued = await api.alice.stats.profitLossSeries({ normalized: true });
		expect(valued.points.find((point) => point.id === entry.id)).toMatchObject({
			buyInTotal: 20_000,
			profitLoss: 0,
		});
	});

	test("retains seconds in timed play when calculating hourly rates", async ({
		api,
	}) => {
		const asset = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Points" })
		);
		const entry = await api.alice.entry.create({
			assetId: asset.id,
			kind: "cash",
			playedOn: "2026-09-01",
			playSessions: [
				{
					endedAt: at("2026-09-01T10:01:30Z"),
					endState: "cashed_out",
					localDate: "2026-09-01",
					payments: [
						pay("buy_in", asset.id, 100),
						pay("cash_out", asset.id, 120),
					],
					startedAt: at("2026-09-01T10:00:00Z"),
				},
			],
			rule: await nlhGame(api.db),
		});
		await insertHands(api, entry.playSessions[0]?.id, ["count"]);
		const summary = await api.alice.stats.summary({ assetId: asset.id });
		expect(summary.playMinutes).toBe(1.5);
		expect(summary.handsPerHour).toBe(40);
		expect(summary.bbPerHour).toBe(400);
	});

	test("includes actual results without recorded EV in the cash EV total", async ({
		api,
	}) => {
		const asset = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Points" })
		);
		const rule = await nlhGame(api.db);
		await api.alice.entry.create({
			assetId: asset.id,
			kind: "cash",
			payments: [
				pay("buy_in", asset.id, 1000),
				pay("cash_out", asset.id, 1500),
			],
			playedOn: "2026-09-01",
			rule,
		});
		expect(await api.alice.stats.summary({ assetId: asset.id })).toMatchObject({
			evDiff: null,
			evProfitLoss: null,
			evRecordedEntryCount: 0,
		});
		await api.alice.entry.create({
			assetId: asset.id,
			evDiff: -1200,
			kind: "cash",
			payments: [
				pay("buy_in", asset.id, 1000),
				pay("cash_out", asset.id, 4000),
			],
			playedOn: "2026-09-02",
			rule,
		});
		expect(await api.alice.stats.summary({ assetId: asset.id })).toMatchObject({
			evDiff: -1200,
			evProfitLoss: 2300,
			evRecordedEntryCount: 1,
		});
		expect(await api.alice.stats.summary({ normalized: true })).toMatchObject({
			evDiff: null,
			evProfitLoss: null,
			evRecordedEntryCount: 1,
			normalized: { cash: { evProfitLoss: 1150 } },
		});
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
				api.alice.stats.summary({ entryTagIds: [bobTag.id], normalized: true })
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(
			await rejection(api.bob.stats.summary({ assetId: jpy.id }))
		).toMatchObject({ code: "FORBIDDEN" });
	});

	test("pools bb/100 over cash hands and paces hands/hour on the days that have both hands and time", async ({
		api,
	}) => {
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const nlh = await nlhGame(api.db);
		const cash = (
			rule: CashInput["rule"],
			playSessions: NonNullable<CashInput["playSessions"]>
		) =>
			api.alice.entry.create({
				assetId: jpy.id,
				kind: "cash",
				playedOn: playSessions[0]?.localDate ?? "",
				playSessions,
				rule,
			});
		const multiDay = await cash(nlh, [
			{
				breakMinutes: 30,
				endedAt: at("2026-09-01T14:00:00Z"),
				endStack: 1200,
				endState: "held",
				localDate: "2026-09-01",
				payments: [pay("buy_in", jpy.id, 1000)],
				startedAt: at("2026-09-01T10:00:00Z"),
			},
			{
				endStack: 1300,
				endState: "held",
				localDate: "2026-09-02",
				payments: [],
			},
			{
				endedAt: at("2026-09-03T11:00:00Z"),
				endState: "cashed_out",
				localDate: "2026-09-03",
				payments: [pay("cash_out", jpy.id, 1400)],
				startedAt: at("2026-09-03T10:00:00Z"),
			},
		]);
		const bigBlindFive = await cash(
			{
				...nlh,
				stakes: nlh.stakes.map((stake) => ({ ...stake, blind1: 2, blind2: 5 })),
			},
			[
				{
					endedAt: at("2026-09-04T12:00:00Z"),
					endState: "cashed_out",
					localDate: "2026-09-04",
					payments: [pay("buy_in", jpy.id, 500), pay("cash_out", jpy.id, 400)],
					startedAt: at("2026-09-04T10:00:00Z"),
				},
			]
		);
		const multiGroup = await cash(
			{
				game: { gameMixId: "alice:builtin-mix:horse" },
				stakes: [
					{ blind1: 2, blind2: 4, gameGroupId: "alice:builtin-group:limit" },
					{ blind1: 2, blind2: 4, gameGroupId: "alice:builtin-group:stud" },
				],
			},
			[
				{
					endedAt: at("2026-09-05T11:00:00Z"),
					endState: "cashed_out",
					localDate: "2026-09-05",
					payments: [pay("buy_in", jpy.id, 100), pay("cash_out", jpy.id, 900)],
					startedAt: at("2026-09-05T10:00:00Z"),
				},
			]
		);
		await cash(nlh, [
			{
				endedAt: at("2026-09-06T11:00:00Z"),
				endState: "cashed_out",
				localDate: "2026-09-06",
				payments: [pay("buy_in", jpy.id, 100), pay("cash_out", jpy.id, 1100)],
				startedAt: at("2026-09-06T10:00:00Z"),
			},
		]);
		const tournament = await api.alice.entry.create({
			assetId: jpy.id,
			kind: "tournament",
			playedOn: "2026-09-07",
			playSessions: [
				{
					endedAt: at("2026-09-07T11:00:00Z"),
					endState: "busted",
					localDate: "2026-09-07",
					payments: [pay("buy_in", jpy.id, 300)],
					startedAt: at("2026-09-07T10:00:00Z"),
				},
			],
		});
		const [day1, untimedDay] = multiDay.playSessions;
		await insertHands(api, day1?.id, [
			"count",
			"count",
			"count",
			"summary",
			"full",
		]);
		await insertHands(api, untimedDay?.id, ["count", "full"]);
		await insertHands(api, bigBlindFive.playSessions[0]?.id, [
			"count",
			"count",
			"count",
		]);
		await insertHands(
			api,
			multiGroup.playSessions[0]?.id,
			Array.from({ length: 10 }, () => "count" as const)
		);
		await insertHands(api, tournament.playSessions[0]?.id, [
			"count",
			"count",
			"count",
			"count",
		]);

		const summary = await api.alice.stats.summary({ assetId: jpy.id });
		expect(summary).toMatchObject({ entryCount: 5, handCount: 24 });
		expect(summary.bb100).toBeCloseTo((100 * (400 / 2 + -100 / 5)) / (7 + 3));
		expect(summary.handsPerHour).toBeCloseTo(
			(5 + 3 + 10 + 4) / ((210 + 120 + 60 + 60) / 60)
		);

		const normalized = await api.alice.stats.summary({ normalized: true });
		expect(normalized.bb100).toBeCloseTo(1800);
		const byLength = await api.alice.stats.breakdown({
			assetId: jpy.id,
			groupBy: "length",
		});
		expect(
			byLength.groups.find((group) => group.key === "4-8h")?.entryCount
		).toBe(1);
		const byKind = await api.alice.stats.breakdown({
			assetId: jpy.id,
			groupBy: "kind",
		});
		expect(
			byKind.groups.map(({ key, bb100, handsPerHour }) => ({
				bb100,
				handsPerHour,
				key,
			}))
		).toEqual([
			{
				bb100: expect.closeTo(1800),
				handsPerHour: expect.closeTo(18 / (390 / 60)),
				key: "cash",
			},
			{ bb100: null, handsPerHour: 4, key: "tournament" },
		]);
	});

	test("scopes filters and breakdowns to owned rooms, kinds, and tournament tags", async ({
		api,
	}) => {
		const asset = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "Points" })
		);
		const rule = await nlhGame(api.db);
		const firstRoom = requireCreatedRow(
			await api.alice.room.create({ name: "First" })
		);
		const secondRoom = requireCreatedRow(
			await api.alice.room.create({ name: "Second" })
		);
		const tag = requireCreatedRow(
			await api.alice.tournamentTag.create({ name: "Featured" })
		);
		const tournament = await api.alice.tournament.create({
			name: "Featured tournament",
			roomId: firstRoom.id,
			rule: {},
			tagIds: [tag.id],
		});
		await api.alice.entry.create({
			assetId: asset.id,
			kind: "cash",
			payments: [pay("buy_in", asset.id, 100), pay("cash_out", asset.id, 200)],
			playedOn: "2025-12-31",
			roomId: firstRoom.id,
			rule,
		});
		await api.alice.entry.create({
			kind: "tournament",
			payments: [pay("buy_in", asset.id, 100), pay("prize", asset.id, 300)],
			playedOn: "2026-01-01",
			roomId: firstRoom.id,
			tournamentId: tournament.id,
		});
		await api.alice.entry.create({
			kind: "tournament",
			payments: [pay("buy_in", asset.id, 300)],
			playedOn: "2026-01-02",
			roomId: secondRoom.id,
		});

		const scope = { assetId: asset.id };
		expect(await api.alice.stats.summary(scope)).toMatchObject({
			amounts: { profitLoss: 0 },
			entryCount: 3,
		});
		expect(
			await api.alice.stats.summary({ ...scope, roomId: firstRoom.id })
		).toMatchObject({ amounts: { profitLoss: 300 }, entryCount: 2 });
		expect(
			await api.alice.stats.summary({ ...scope, kind: "tournament" })
		).toMatchObject({ amounts: { profitLoss: -100 }, entryCount: 2 });
		expect(
			await api.alice.stats.summary({ ...scope, tournamentTagIds: [tag.id] })
		).toMatchObject({ amounts: { profitLoss: 200 }, entryCount: 1 });
		expect(
			await api.alice.stats.summary({
				...scope,
				kind: "tournament",
				roomId: secondRoom.id,
				tournamentTagIds: [tag.id],
			})
		).toMatchObject({ amounts: { profitLoss: 0 }, entryCount: 0 });

		const byRoom = await api.alice.stats.breakdown({
			...scope,
			groupBy: "room",
		});
		expect(
			byRoom.groups.map(({ key, entryCount }) => ({ entryCount, key }))
		).toEqual(
			expect.arrayContaining([
				{ entryCount: 2, key: firstRoom.id },
				{ entryCount: 1, key: secondRoom.id },
			])
		);
		expect(byRoom.groups).toHaveLength(2);
		const byStakes = await api.alice.stats.breakdown({
			...scope,
			groupBy: "stakes",
		});
		expect(
			byStakes.groups.map(({ key, entryCount }) => ({ entryCount, key }))
		).toEqual(
			expect.arrayContaining([
				{ entryCount: 1, key: `${rule.stakes[0]?.gameGroupId}:1/2///` },
				{ entryCount: 2, key: "tournament" },
			])
		);
		expect(byStakes.groups).toHaveLength(2);
		const byVariant = await api.alice.stats.breakdown({
			...scope,
			groupBy: "variant",
		});
		expect(
			byVariant.groups.map(({ key, entryCount }) => ({ entryCount, key }))
		).toEqual([{ entryCount: 3, key: `variant:${rule.game.variantId}` }]);
		const byYear = await api.alice.stats.breakdown({
			...scope,
			groupBy: "year",
		});
		expect(
			byYear.groups.map(({ key, entryCount }) => ({ entryCount, key }))
		).toEqual([
			{ entryCount: 1, key: "2025" },
			{ entryCount: 2, key: "2026" },
		]);

		const foreignRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Foreign" })
		);
		const foreignTag = requireCreatedRow(
			await api.bob.tournamentTag.create({ name: "Foreign" })
		);
		const foreignAsset = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Foreign" })
		);
		expect(
			await rejection(
				api.alice.stats.summary({ ...scope, roomId: foreignRoom.id })
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(
			await rejection(
				api.alice.stats.summary({ ...scope, tournamentTagIds: [foreignTag.id] })
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(
			await rejection(
				api.alice.stats.summary({
					baseAssetId: foreignAsset.id,
					valuation: "real",
				})
			)
		).toMatchObject({ code: "FORBIDDEN" });
	});
});
