import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { entryTagLink } from "@sapphire2/db/schema/entry-tag";
import { hand } from "@sapphire2/db/schema/hand";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { tournamentRule } from "@sapphire2/db/schema/rule";
import { MAX_LINKED_TAGS } from "@sapphire2/db/schemas/tag-ids";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import { buildLiveEntryStartStatements } from "../services/entry-live-writes";
import { planEntryRule } from "../services/entry-rules";
import {
	MAX_ENTRY_PAYMENTS,
	MAX_ENTRY_PLAY_SESSIONS,
} from "../services/entry-writes";
import { MAX_RULE_PRICES } from "../services/tournament-rule";
import {
	type ApiFixture,
	AUTH_QUERY_RESERVE,
	D1_QUERIES_PER_INVOCATION,
	nlhGame,
	requireCreatedRow,
	seedMaxRuleLevels,
	test,
} from "./test-fixture";

const DAY = 86_400;
const SEP_1 = Date.UTC(2026, 8, 1) / 1000;

async function setup(api: ApiFixture) {
	const jpy = requireCreatedRow(
		await api.alice.asset.create({ kind: "currency", name: "JPY" })
	);
	const usd = requireCreatedRow(
		await api.alice.asset.create({ decimals: 2, kind: "currency", name: "USD" })
	);
	const ticket = requireCreatedRow(
		await api.alice.asset.create({ kind: "item", name: "Main ticket" })
	);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	return { jpy, room, rule: await nlhGame(api.db), ticket, usd };
}

function real(
	role: "buy_in" | "addon" | "chip_remove" | "cash_out",
	assetId: string,
	quantity: number
) {
	return { assetId, effect: "real" as const, quantity, role };
}

describe("entry API on D1", () => {
	test("rejects a room archived while creating an entry", async ({ api }) => {
		const { room, rule } = await setup(api);
		const raced = api.raceCaller("alice", () =>
			api.alice.room.archive({ id: room.id })
		);
		await expect(
			raced.entry.create({
				kind: "cash",
				playedOn: "2026-09-01",
				roomId: room.id,
				rule,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await api.db.select().from(entry)).toEqual([]);
	});

	test("rejects a stale date validation after a concurrent day replacement", async ({
		api,
	}) => {
		const { rule } = await setup(api);
		const created = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule,
		});
		const raced = api.raceCaller("alice", () =>
			api.alice.entry.update({
				id: created.id,
				playedOn: "2026-09-02",
				playSessions: [
					{
						endState: "cashed_out",
						localDate: "2026-09-02",
						payments: [],
					},
				],
			})
		);
		await expect(
			raced.entry.update({ id: created.id, playedOn: "2026-09-01" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		const current = await api.alice.entry.getById({ id: created.id });
		expect(current.playedOn).toBe("2026-09-02");
		expect(current.playSessions.map((play) => play.localDate)).toEqual([
			"2026-09-02",
		]);
	});

	test("a two-day cash entry round-trips, keeps a day with its hands across an edit, and an inverse update restores it", async ({
		api,
	}) => {
		const { jpy, room, rule } = await setup(api);
		const originalDays = [
			{
				breakMinutes: 30,
				endedAt: SEP_1 + 23 * 3600,
				endStack: 41_000,
				endState: "held" as const,
				localDate: "2026-09-01",
				payments: [real("buy_in", jpy.id, 30_000)],
				startedAt: SEP_1 + 18 * 3600,
			},
			{
				endedAt: SEP_1 + DAY + 20 * 3600 + 30,
				endState: "cashed_out" as const,
				localDate: "2026-09-02",
				payments: [
					real("addon", jpy.id, 10_000),
					real("chip_remove", jpy.id, 5000),
					real("cash_out", jpy.id, 42_000),
				],
				startedAt: SEP_1 + DAY + 18 * 3600,
			},
		];
		const created = await api.alice.entry.create({
			assetId: jpy.id,
			evDiff: -1200,
			kind: "cash",
			playedOn: "2026-09-01",
			playSessions: originalDays,
			roomId: room.id,
			rule,
			title: "Weekend",
		});
		expect(created).toMatchObject({
			cash: { bigBlind: 2, evDiff: -1200 },
			kind: "cash",
			playedOn: "2026-09-01",
			playMinutes: 270 + 120.5,
			roomName: "Club",
			ruleDrift: false,
			source: "manual",
			status: "settled",
			totals: [
				{
					assetId: jpy.id,
					buyIn: 40_000,
					cashOut: 47_000,
					effect: "real",
					profitLoss: 42_000 + 5000 - 30_000 - 10_000,
				},
			],
		});
		const [first, second] = created.playSessions;
		if (!(first && second)) {
			throw new Error("expected two days");
		}
		expect([first.seq, second.seq]).toEqual([1, 2]);
		await api.db.insert(hand).values({
			detail: "count",
			handNo: 1,
			id: "kept-hand",
			playSessionId: first.id,
			updatedAt: new Date(),
			userId: "alice",
		});
		expect(await api.alice.entry.getById({ id: created.id })).toEqual({
			...created,
			handCount: 1,
		});

		const before = await api.alice.entry.getById({ id: created.id });
		const edited = await api.alice.entry.update({
			id: created.id,
			playSessions: [
				{
					endedAt: SEP_1 + 22 * 3600,
					endStack: 41_000,
					endState: "held",
					id: first.id,
					localDate: "2026-09-01",
					payments: [real("buy_in", jpy.id, 20_000)],
					startedAt: SEP_1 + 18 * 3600,
				},
				{
					endState: "cashed_out",
					id: second.id,
					localDate: "2026-09-02",
					payments: [real("cash_out", jpy.id, 25_000)],
				},
			],
		});
		expect(edited.handCount).toBe(1);
		expect(edited.playSessions.map((play) => play.id)).toEqual([
			first.id,
			second.id,
		]);
		expect(edited.totals[0]?.profitLoss).toBe(5000);

		const restored = await api.alice.entry.update({
			id: created.id,
			playSessions: originalDays.map((day, index) => ({
				...day,
				id: before.playSessions[index]?.id,
			})),
		});
		expect({ ...restored, updatedAt: before.updatedAt }).toEqual(before);
	});

	test("manual create and day replacement roll back when a ledger insert fails", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const created = await api.alice.entry.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 100)],
			playedOn: "2026-09-01",
			rule,
		});
		const day = created.playSessions[0];
		if (!day) {
			throw new Error("expected a day");
		}
		await api.db.insert(hand).values({
			detail: "count",
			handNo: 1,
			id: "rollback-hand",
			playSessionId: day.id,
			updatedAt: new Date(),
			userId: "alice",
		});
		const snapshot = async () => ({
			cash: await api.db.select().from(entryCash),
			entries: await api.db.select().from(entry),
			hands: await api.db.select().from(hand),
			lines: await api.db.select().from(ledgerLine),
			plays: await api.db.select().from(playSession),
			tournaments: await api.db.select().from(entryTournament),
		});
		const before = await snapshot();
		await api.d1
			.prepare(
				"CREATE TRIGGER fail_manual_ledger BEFORE INSERT ON ledger_line WHEN NEW.quantity = -987654 BEGIN SELECT RAISE(ABORT, 'forced'); END;"
			)
			.run();
		await expect(
			api.alice.entry.update({
				id: created.id,
				playSessions: [
					{
						endState: "cashed_out",
						localDate: "2026-09-01",
						payments: [real("buy_in", jpy.id, 987_654)],
					},
				],
				title: "Changed",
			})
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		expect(await snapshot()).toEqual(before);
		await expect(
			api.alice.entry.create({
				kind: "cash",
				payments: [real("buy_in", jpy.id, 987_654)],
				playedOn: "2026-09-02",
				rule,
			})
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		expect(await snapshot()).toEqual(before);
	});

	test("omitting a day deletes it with its hands; the entry keeps the rest", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const created = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			playSessions: [
				{
					endStack: 100,
					endState: "held",
					localDate: "2026-09-01",
					payments: [real("buy_in", jpy.id, 300)],
				},
				{
					endState: "cashed_out",
					localDate: "2026-09-03",
					payments: [real("cash_out", jpy.id, 100)],
				},
			],
			rule,
		});
		const dropped = created.playSessions[1]?.id ?? "";
		await api.db.insert(hand).values({
			detail: "count",
			handNo: 1,
			id: "dropped-hand",
			playSessionId: dropped,
			updatedAt: new Date(),
			userId: "alice",
		});
		const updated = await api.alice.entry.update({
			id: created.id,
			playSessions: [
				{
					endState: "cashed_out",
					id: created.playSessions[0]?.id,
					localDate: "2026-09-01",
					payments: [real("buy_in", jpy.id, 300), real("cash_out", jpy.id, 50)],
				},
			],
		});
		expect(updated.playSessions).toHaveLength(1);
		expect(updated.handCount).toBe(0);
		expect(
			await api.db.select().from(playSession).where(eq(playSession.id, dropped))
		).toEqual([]);
		expect(updated.totals[0]?.profitLoss).toBe(-250);
	});

	test("tournament money across a ticket and a currency is totalled per asset and valued with per-entry missing rates", async ({
		api,
	}) => {
		const { jpy, usd, ticket } = await setup(api);
		await api.alice.userSetting.update({ baseAssetId: jpy.id });
		await api.alice.assetRate.create({
			baseAssetId: ticket.id,
			effectiveFrom: 0,
			quoteAssetId: jpy.id,
			rateDen: 1,
			rateNum: 10_000,
		});
		const linked = await api.alice.tournament.create({
			name: "Main",
			roomId: requireCreatedRow(await api.alice.room.create({ name: "Hall" }))
				.id,
			rule: {
				prices: [
					{
						amount: 1,
						assetId: ticket.id,
						chips: 20_000,
						fee: 0,
						kind: "entry",
					},
				],
			},
		});
		const master = await api.alice.tournament.getById({ id: linked.id });
		const priceId = master.ruleVersion.prices[0]?.id ?? "";
		const valued = await api.alice.entry.create({
			kind: "tournament",
			payments: [
				{
					assetId: ticket.id,
					effect: "real",
					priceId,
					quantity: 1,
					role: "buy_in",
				},
				{ assetId: jpy.id, effect: "real", quantity: 1000, role: "fee" },
				{
					assetId: jpy.id,
					effect: "real",
					quantity: 2000,
					role: "chip_purchase",
				},
				{ assetId: jpy.id, effect: "real", quantity: 30_000, role: "prize" },
				{ assetId: jpy.id, effect: "real", quantity: 2000, role: "bounty" },
			],
			placement: 3,
			playedOn: "2026-09-01",
			totalEntries: 120,
			tournamentId: linked.id,
		});
		expect(valued.playSessions).toMatchObject([{ endState: "busted" }]);
		expect(valued.totals).toEqual(
			[
				{
					assetId: jpy.id,
					buyIn: 3000,
					cashOut: 32_000,
					effect: "real",
					profitLoss: 30_000 + 2000 - 1000 - 2000,
					roleTotals: {
						bounty: { lineCount: 1, quantity: 2000 },
						chip_purchase: { lineCount: 1, quantity: -2000 },
						fee: { lineCount: 1, quantity: -1000 },
						prize: { lineCount: 1, quantity: 30_000 },
					},
				},
				{
					assetId: ticket.id,
					buyIn: 1,
					cashOut: 0,
					effect: "real",
					profitLoss: -1,
					roleTotals: { buy_in: { lineCount: 1, quantity: -1 } },
				},
			].sort((a, b) => a.assetId.localeCompare(b.assetId))
		);
		expect(valued.valuation).toMatchObject({
			baseAssetId: jpy.id,
			missingRates: { real: [], virtual: [] },
			real: { buyIn: 3000, cashOut: 32_000, profitLoss: 29_000 },
			virtual: { buyIn: 13_000, cashOut: 32_000, profitLoss: 19_000 },
		});
		expect(valued.lines.find((line) => line.role === "buy_in")?.priceId).toBe(
			priceId
		);

		const unrated = await api.alice.entry.create({
			kind: "cash",
			payments: [real("buy_in", usd.id, 100), real("cash_out", usd.id, 300)],
			playedOn: "2026-09-02",
			rule: await nlhGame(api.db),
		});
		expect(unrated.valuation.missingRates.real).toEqual([
			expect.objectContaining({ assetId: usd.id }),
		]);
		expect(
			(await api.alice.entry.getById({ id: valued.id })).valuation.missingRates
				.real
		).toEqual([]);

		await expect(
			api.alice.entry.create({
				kind: "tournament",
				payments: [
					{
						assetId: jpy.id,
						effect: "real",
						priceId,
						quantity: 1,
						role: "buy_in",
					},
				],
				playedOn: "2026-09-01",
				tournamentId: linked.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.entry.create({
				kind: "tournament",
				payments: [
					{
						assetId: ticket.id,
						effect: "real",
						priceId,
						quantity: 1,
						role: "buy_in",
					},
				],
				playedOn: "2026-09-01",
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("archived payment assets cannot be added to existing entries", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const created = await api.alice.entry.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 100)],
			playedOn: "2026-09-01",
			rule,
		});
		await api.alice.asset.archive({ id: jpy.id });
		await api.alice.entry.update({
			id: created.id,
			payments: [real("buy_in", jpy.id, 120)],
		});
		await expect(
			api.alice.entry.update({
				id: created.id,
				payments: [real("buy_in", jpy.id, 120), real("cash_out", jpy.id, 200)],
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const saved = await api.alice.entry.getById({ id: created.id });
		expect(saved.lines).toHaveLength(1);
		expect(saved.lines[0]?.quantity).toBe(-120);
	});

	test("an archived asset and an inconsistent request write nothing", async ({
		api,
	}) => {
		const { jpy, usd, rule } = await setup(api);
		await api.alice.asset.archive({ id: usd.id });
		const rejected = [
			{
				kind: "cash" as const,
				payments: [real("buy_in", usd.id, 100)],
				playedOn: "2026-09-01",
				rule,
			},
			{
				kind: "cash" as const,
				playedOn: "2026-09-02",
				playSessions: [
					{
						endState: "cashed_out" as const,
						localDate: "2026-09-01",
						payments: [real("buy_in", jpy.id, 100)],
					},
				],
				rule,
			},
			{
				kind: "cash" as const,
				playedOn: "2026-09-01",
				playSessions: [
					{
						endState: "cashed_out" as const,
						localDate: "2026-09-01",
						payments: [],
					},
					{
						endState: "cashed_out" as const,
						localDate: "2026-09-02",
						payments: [],
					},
				],
				rule,
			},
			{
				kind: "cash" as const,
				playedOn: "2026-09-01",
				playSessions: [
					{
						endedAt: SEP_1 + 3600,
						endState: "cashed_out" as const,
						localDate: "2026-09-01",
						payments: [],
						startedAt: SEP_1 + 7200,
					},
				],
				rule,
			},
		];
		for (const input of rejected) {
			await expect(api.alice.entry.create(input)).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		}
		for (const playedOn of ["2026-02-30", "2026-09-01T00:00:00Z"]) {
			await expect(
				api.alice.entry.create({ kind: "cash", playedOn, rule })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		await expect(
			api.alice.entry.create({
				kind: "tournament",
				placement: 5,
				playedOn: "2026-09-01",
				totalEntries: 4,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await api.db.select().from(entry)).toEqual([]);
		expect(await api.db.select().from(tournamentRule)).toEqual([]);

		const tag = await api.alice.entryTag.create({ name: "Live" });
		await expect(
			api.alice.entry.create({
				kind: "cash",
				playedOn: "2026-09-01",
				rule,
				tagIds: [tag.id, tag.id],
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const settled = await api.alice.entry.create({
			kind: "tournament",
			placement: 4,
			playedOn: "2026-09-01",
			totalEntries: 10,
		});
		await expect(
			api.alice.entry.update({ id: settled.id, totalEntries: 3 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await api.alice.entry.update({ beforeDeadline: true, id: settled.id }))
				.tournament
		).toEqual({ beforeDeadline: true, placement: null, totalEntries: 10 });
		await expect(
			api.alice.entry.update({ evDiff: 10, id: settled.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("a live entry accepts metadata only", async ({ api }) => {
		const { jpy, rule } = await setup(api);
		const planned = await planEntryRule(api.db, "alice", {
			kind: "cash",
			ringGameId: null,
			rule,
		});
		await runBatch(api.db, [
			...planned.statements,
			...buildLiveEntryStartStatements(api.db, {
				assetId: jpy.id,
				detail: {
					cashRuleId: planned.ruleVersionId,
					kind: "cash",
					ringGameId: null,
				},
				id: "live-cash",
				localDate: "2026-09-05",
				memo: null,
				now: new Date(),
				roomId: null,
				startEvent: {
					occurredAt: new Date(),
					payload: {
						payments: [{ assetId: jpy.id, quantity: 30_000, role: "buy_in" }],
					},
				},
				userId: "alice",
			}),
		]);
		const tag = await api.alice.entryTag.create({ name: "Live" });
		expect(
			await api.alice.entry.update({
				id: "live-cash",
				tagIds: [tag.id],
				title: "Friday",
			})
		).toMatchObject({
			source: "live",
			status: "open",
			tags: [{ id: tag.id, name: "Live" }],
			title: "Friday",
		});
		for (const patch of [
			{ playedOn: "2026-09-04" },
			{ payments: [real("buy_in", jpy.id, 1)] },
			{ evDiff: 5 },
		]) {
			await expect(
				api.alice.entry.update({ id: "live-cash", ...patch })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
	});

	test("list filters, pages across same-day entries and a deleted boundary row, and rejects a cursor from another scope", async ({
		api,
	}) => {
		const { jpy, usd, room, rule } = await setup(api);
		const ids: string[] = [];
		for (const [playedOn, assetId] of [
			["2026-09-01", jpy.id],
			["2026-09-02", jpy.id],
			["2026-09-02", usd.id],
			["2026-09-02", jpy.id],
			["2026-09-03", jpy.id],
		] as const) {
			ids.push(
				(
					await api.alice.entry.create({
						kind: "cash",
						payments: [real("buy_in", assetId, 10)],
						playedOn,
						roomId: room.id,
						rule,
					})
				).id
			);
		}
		expect(
			(await api.alice.entry.list({ assetId: usd.id })).items.map(
				(item) => item.id
			)
		).toEqual([ids[2]]);
		const page = await api.alice.entry.list({
			dateFrom: "2026-09-02",
			dateTo: "2026-09-02",
			limit: 2,
		});
		expect(page.items).toHaveLength(2);
		const boundary = page.items[1]?.id ?? "";
		await api.alice.entry.delete({ id: boundary });
		const rest = await api.alice.entry.list({
			cursor: page.nextCursor ?? undefined,
			dateFrom: "2026-09-02",
			dateTo: "2026-09-02",
			limit: 2,
		});
		expect(
			[...page.items, ...rest.items].map((item) => item.id).sort()
		).toEqual([...ids.slice(1, 4)].sort());
		expect(rest.nextCursor).toBeNull();

		await expect(
			api.alice.entry.list({ cursor: page.nextCursor ?? undefined })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.bob.entry.list({
				cursor: page.nextCursor ?? undefined,
				dateFrom: "2026-09-02",
				dateTo: "2026-09-02",
				limit: 2,
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.entry.list({ dateFrom: "2026-09-03", dateTo: "2026-09-01" })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await api.bob.entry.list({})).items).toEqual([]);
	});

	test("every foreign id is FORBIDDEN and delete cascades only the owner's entry", async ({
		api,
	}) => {
		const { jpy, room, rule } = await setup(api);
		const tag = await api.alice.entryTag.create({ name: "Mine" });
		const owned = await api.alice.entry.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 10)],
			playedOn: "2026-09-01",
			roomId: room.id,
			rule,
			tagIds: [tag.id],
		});
		const kept = await api.alice.entry.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 20)],
			playedOn: "2026-09-01",
			rule,
		});
		const bobRule = await nlhGame(api.db, "bob");
		for (const call of [
			() => api.bob.entry.getById({ id: owned.id }),
			() => api.bob.entry.update({ id: owned.id, title: "x" }),
			() => api.bob.entry.delete({ id: owned.id }),
			() => api.bob.entry.list({ roomId: room.id }),
			() =>
				api.bob.entry.create({
					kind: "cash",
					playedOn: "2026-09-01",
					roomId: room.id,
					rule: bobRule,
				}),
			() =>
				api.bob.entry.create({
					kind: "cash",
					payments: [real("buy_in", jpy.id, 1)],
					playedOn: "2026-09-01",
					rule: bobRule,
				}),
			() =>
				api.bob.entry.create({
					kind: "cash",
					playedOn: "2026-09-01",
					rule: bobRule,
					tagIds: [tag.id],
				}),
			() =>
				api.alice.entry.update({
					id: kept.id,
					playSessions: [
						{
							endState: "cashed_out",
							id: owned.playSessions[0]?.id,
							localDate: "2026-09-01",
							payments: [],
						},
					],
				}),
		]) {
			await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
		}

		await api.alice.entry.delete({ id: owned.id });
		expect(
			(await api.db.select({ id: entry.id }).from(entry)).map((row) => row.id)
		).toEqual([kept.id]);
		expect(
			await api.db
				.select({ id: ledgerLine.id })
				.from(ledgerLine)
				.where(eq(ledgerLine.entryId, owned.id))
		).toEqual([]);
		expect(await api.db.select().from(entryTagLink)).toEqual([]);
		expect(await api.alice.entryTag.list()).toHaveLength(1);
	});

	test("create and update at the entry maxima with a maximal tournament rule stay inside the D1 query budget", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const { levels } = await seedMaxRuleLevels(api);
		const tagIds: string[] = [];
		for (let index = 0; index < MAX_LINKED_TAGS; index += 1) {
			tagIds.push(
				(await api.alice.entryTag.create({ name: `Tag ${index}` })).id
			);
		}
		const perDay = MAX_ENTRY_PAYMENTS / MAX_ENTRY_PLAY_SESSIONS;
		const days = (ids: (string | undefined)[]) =>
			ids.map((id, index) => ({
				endedAt: SEP_1 + index * DAY + 3600,
				endStack: index === ids.length - 1 ? undefined : 1000,
				endState:
					index === ids.length - 1 ? ("busted" as const) : ("bagged" as const),
				id,
				localDate: new Date((SEP_1 + index * DAY) * 1000)
					.toISOString()
					.slice(0, 10),
				payments: Array.from({ length: perDay }, (_, n) => ({
					assetId: jpy.id,
					effect: "real" as const,
					quantity: n + 1,
					role: "chip_purchase" as const,
				})),
				startedAt: SEP_1 + index * DAY,
			}));
		const created = api.meteredCaller("alice");
		const entryOutput = await created.caller.entry.create({
			kind: "tournament",
			playedOn: "2026-09-01",
			playSessions: days(
				Array.from({ length: MAX_ENTRY_PLAY_SESSIONS }, () => undefined)
			),
			rule: {
				levels,
				prices: Array.from({ length: MAX_RULE_PRICES }, (_, index) => ({
					amount: index,
					assetId: jpy.id,
					chips: 1000,
					fee: 0,
					kind: "addon" as const,
				})),
			},
			tagIds,
		});
		expect(entryOutput.lines).toHaveLength(MAX_ENTRY_PAYMENTS);
		expect(created.meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);

		const updated = api.meteredCaller("alice");
		const output = await updated.caller.entry.update({
			id: entryOutput.id,
			playSessions: days(entryOutput.playSessions.map((play) => play.id)),
			tagIds: [...tagIds].reverse(),
		});
		expect(output.playSessions).toHaveLength(MAX_ENTRY_PLAY_SESSIONS);
		expect(updated.meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
	});
});
