import type { LedgerRole } from "@sapphire2/db/constants/ledger";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { tournamentRule } from "@sapphire2/db/schema/rule";
import { describe, expect } from "vitest";
import type { EntryOutput } from "../services/entry-reads";
import { MAX_ENTRY_PAYMENTS } from "../services/entry-writes";
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

const HOUR = 3600;

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

function real<Role extends LedgerRole>(
	role: Role,
	assetId: string,
	quantity: number
) {
	return { role, assetId, quantity, effect: "real" as const };
}

function tournamentPrices(output: EntryOutput) {
	if (output.kind !== "tournament") {
		throw new Error("expected a tournament entry");
	}
	return output.ruleVersion.prices;
}

async function setup(api: ApiFixture) {
	const rule = await nlhGame(api.db);
	const jpy = requireCreatedRow(
		await api.alice.asset.create({ name: "JPY", kind: "currency" })
	);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	return { jpy, room, rule };
}

async function everyRow(api: ApiFixture) {
	return {
		entries: await api.db.select().from(entry),
		plays: await api.db.select().from(playSession),
		events: await api.db.select().from(playEvent),
		lines: await api.db.select().from(ledgerLine),
	};
}

async function failure(promise: Promise<unknown>) {
	return await promise.then(
		() => {
			throw new Error("expected the call to fail");
		},
		(error: unknown) => error
	);
}

describe("live API on D1", () => {
	test("a cash session starts, records events and completes as a settled entry with its profit", async ({
		api,
	}) => {
		const { jpy, room, rule } = await setup(api);
		const startedAt = nowSeconds() - 2 * HOUR;
		const started = await api.alice.live.create({
			kind: "cash",
			roomId: room.id,
			rule,
			startedAt,
			payments: [real("buy_in", jpy.id, 10_000)],
		});
		expect(started).toMatchObject({
			kind: "cash",
			source: "live",
			status: "open",
			progress: null,
		});
		expect(started.playSessions).toMatchObject([{ seq: 1, status: "active" }]);

		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "session_pause",
			occurredAt: startedAt + 600,
			payload: {},
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "session_resume",
			occurredAt: startedAt + 1200,
			payload: {},
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "chips_add_remove",
			occurredAt: startedAt + 1800,
			payload: { amount: 5000, assetId: jpy.id },
		});

		const detail = await api.alice.live.getById({ id: started.id });
		expect(detail.currentPlaySessionId).toBe(started.playSessions[0]?.id);
		expect(detail.events.map((event) => event.eventType)).toEqual([
			"session_start",
			"session_pause",
			"session_resume",
			"chips_add_remove",
		]);
		expect(detail.events.every((event) => event.schemaVersion === 2)).toBe(
			true
		);
		expect(detail.events[3]?.payload).toEqual({
			amount: 5000,
			assetId: jpy.id,
			effect: "real",
		});

		const completed = await api.alice.live.complete({
			id: started.id,
			occurredAt: startedAt + HOUR,
			endState: "cashed_out",
			payments: [real("cash_out", jpy.id, 22_000)],
		});
		expect(completed.status).toBe("settled");
		expect(completed.playSessions).toMatchObject([
			{ status: "ended", endState: "cashed_out", breakMinutes: 10 },
		]);
		expect(completed.totals).toMatchObject([
			{ assetId: jpy.id, effect: "real", buyIn: 15_000, cashOut: 22_000 },
		]);
		expect(completed.totals[0]?.profitLoss).toBe(7000);
		expect(
			(await api.alice.live.list({})).items.map((item) => item.id)
		).toEqual([started.id]);
	});

	test("tournament progress folds stack reports, purchases and explicit clears", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const startedAt = nowSeconds() - 3 * HOUR;
		const started = await api.alice.live.create({
			kind: "tournament",
			startedAt,
			initialStack: 20_000,
			rule: {
				startingStack: 20_000,
				prices: [
					{
						kind: "entry",
						assetId: jpy.id,
						amount: 10_000,
						fee: 1000,
						chips: null,
					},
					{
						kind: "addon",
						assetId: jpy.id,
						amount: 5000,
						fee: 500,
						chips: 30_000,
					},
				],
			},
			payments: [real("buy_in", jpy.id, 10_000), real("fee", jpy.id, 1000)],
		});
		expect(started.progress).toEqual({
			currentStack: 20_000,
			remainingPlayers: null,
			totalEntries: null,
			chipTotal: 0,
			averageStack: null,
		});
		const addon = tournamentPrices(started).find(
			(price) => price.kind === "addon"
		);

		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "update_stack",
			occurredAt: startedAt + 600,
			payload: {
				stackAmount: 25_000,
				remainingPlayers: 40,
				totalEntries: 50,
				chipPurchaseCounts: [
					{ name: "Rebuy", count: 10, chipsPerUnit: 20_000 },
				],
			},
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "purchase_chips",
			occurredAt: startedAt + 1200,
			payload: {
				priceId: addon?.id ?? "",
				payments: [
					real("chip_purchase", jpy.id, 5000),
					real("fee", jpy.id, 500),
				],
			},
		});
		const purchased = await api.alice.live.getById({ id: started.id });
		expect(purchased.events.at(-1)?.payload).toMatchObject({
			chips: 30_000,
			priceId: addon?.id,
		});
		expect(purchased.progress).toEqual({
			currentStack: 25_000,
			remainingPlayers: 40,
			totalEntries: 50,
			chipTotal: 230_000,
			averageStack: Math.round((20_000 * 50 + 230_000) / 40),
		});

		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "update_stack",
			occurredAt: startedAt + 1800,
			payload: { stackAmount: 40_000, remainingPlayers: null },
		});
		const cleared = await api.alice.live.getById({ id: started.id });
		expect(cleared.progress).toMatchObject({
			currentStack: 40_000,
			remainingPlayers: null,
			totalEntries: 50,
			averageStack: null,
		});

		const completed = await api.alice.live.complete({
			id: started.id,
			occurredAt: startedAt + 2 * HOUR,
			endState: "busted",
			placement: 12,
			totalEntries: 50,
			payments: [],
		});
		expect(completed).toMatchObject({
			status: "settled",
			tournament: { placement: 12, totalEntries: 50, beforeDeadline: false },
		});
		expect(completed.playSessions[0]?.endState).toBe("busted");
	});

	test("two concurrent starts leave exactly one live session and no stray rule rows", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const start = () =>
			api.alice.live.create({
				kind: "tournament",
				rule: { startingStack: 10_000 },
				payments: [real("buy_in", jpy.id, 1000)],
			});
		const results = await Promise.allSettled([start(), start()]);
		expect(
			results.filter((result) => result.status === "fulfilled")
		).toHaveLength(1);
		const rejected = results.find((result) => result.status === "rejected");
		expect(rejected?.reason).toMatchObject({ code: "CONFLICT" });
		expect(await api.db.select().from(entry)).toHaveLength(1);
		expect(await api.db.select().from(tournamentRule)).toHaveLength(1);

		expect(await failure(start())).toMatchObject({ code: "CONFLICT" });
	});

	test("the start date is read in the user's time zone, Asia/Tokyo when unset, unless given", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const startedAt = Date.UTC(2025, 0, 10, 16) / 1000;
		const startOn = async (localDate?: string) => {
			const started = await api.alice.live.create({
				kind: "cash",
				startedAt,
				rule,
				localDate,
				payments: [real("buy_in", jpy.id, 100)],
			});
			await api.alice.live.discard({ id: started.id });
			return [started.playedOn, started.playSessions[0]?.localDate];
		};

		expect(await startOn()).toEqual(["2025-01-11", "2025-01-11"]);
		await api.alice.userSetting.update({ timeZone: "America/Los_Angeles" });
		expect(await startOn()).toEqual(["2025-01-10", "2025-01-10"]);
		expect(await startOn("2025-01-12")).toEqual(["2025-01-12", "2025-01-12"]);
	});

	test("event times beyond the clock skew and terminal times before recorded events are rejected without writes", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		expect(
			await failure(
				api.alice.live.create({
					kind: "cash",
					startedAt: nowSeconds() + 600,
					rule,
					payments: [],
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		const startedAt = nowSeconds() - HOUR;
		const started = await api.alice.live.create({
			kind: "cash",
			startedAt,
			rule,
			payments: [real("buy_in", jpy.id, 100)],
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "memo",
			occurredAt: startedAt + 1800,
			payload: { text: "Table broke" },
		});
		const before = await everyRow(api);

		for (const error of await Promise.all(
			[
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "memo",
					occurredAt: nowSeconds() + 600,
					payload: { text: "later" },
				}),
				api.alice.live.complete({
					id: started.id,
					occurredAt: startedAt + 600,
					endState: "cashed_out",
					payments: [],
				}),
				api.alice.live.complete({
					id: started.id,
					endState: "busted",
					payments: [],
				}),
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "purchase_chips",
					payload: { priceId: "price", payments: [] },
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "BAD_REQUEST" });
		}
		expect(await everyRow(api)).toEqual(before);

		await api.alice.live.complete({
			id: started.id,
			endState: "cashed_out",
			payments: [real("cash_out", jpy.id, 100)],
		});
		for (const error of await Promise.all(
			[
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "memo",
					payload: { text: "after the end" },
				}),
				api.alice.live.complete({
					id: started.id,
					endState: "cashed_out",
					payments: [],
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
		}
		expect(
			await failure(api.alice.live.discard({ id: started.id }))
		).toMatchObject({ code: "PRECONDITION_FAILED" });
	});

	test("another user's entry, event, player, tag, price, room and asset are FORBIDDEN without writes", async ({
		api,
	}) => {
		const { jpy, room } = await setup(api);
		const aliceEntry = await api.alice.live.create({
			kind: "tournament",
			rule: {
				prices: [
					{ kind: "addon", assetId: jpy.id, amount: 100, fee: 0, chips: 10 },
				],
			},
			payments: [],
		});
		const memo = await api.alice.playEvent.create({
			entryId: aliceEntry.id,
			eventType: "memo",
			payload: { text: "mine" },
		});
		const alicePlayer = requireCreatedRow(
			await api.alice.player.create({ name: "Villain" })
		);
		const [aliceTag] = await api.createPlayerTags("alice", 1);
		const priceId = tournamentPrices(aliceEntry)[0]?.id ?? "";

		const bobRule = await nlhGame(api.db, "bob");
		const bobEntry = await api.bob.live.create({
			kind: "tournament",
			payments: [],
		});
		const before = await everyRow(api);

		for (const error of await Promise.all(
			[
				api.bob.live.getById({ id: aliceEntry.id }),
				api.bob.live.update({ id: aliceEntry.id, memo: "x" }),
				api.bob.live.complete({
					id: aliceEntry.id,
					endState: "busted",
					beforeDeadline: true,
					payments: [],
				}),
				api.bob.live.discard({ id: aliceEntry.id }),
				api.bob.playEvent.list({ entryId: aliceEntry.id }),
				api.bob.playEvent.create({
					entryId: aliceEntry.id,
					eventType: "memo",
					payload: { text: "theirs" },
				}),
				api.bob.playEvent.update({ id: memo.id, payload: { text: "x" } }),
				api.bob.playEvent.delete({ id: memo.id }),
				api.bob.playEvent.create({
					entryId: bobEntry.id,
					playSessionId: aliceEntry.playSessions[0]?.id,
					eventType: "memo",
					payload: { text: "x" },
				}),
				api.bob.playEvent.create({
					entryId: bobEntry.id,
					eventType: "purchase_chips",
					payload: { priceId, payments: [] },
				}),
				api.bob.tablePlayer.list({ entryId: aliceEntry.id }),
				api.bob.tablePlayer.add({
					entryId: aliceEntry.id,
					playerId: alicePlayer.id,
				}),
				api.bob.tablePlayer.add({
					entryId: bobEntry.id,
					playerId: alicePlayer.id,
					seatPosition: 9,
				}),
				api.bob.tablePlayer.updateSeat({
					entryId: bobEntry.id,
					playerId: alicePlayer.id,
					seatPosition: null,
				}),
				api.bob.tablePlayer.addNew({
					entryId: bobEntry.id,
					playerName: "New",
					playerTagIds: [aliceTag ?? ""],
				}),
				api.bob.live.update({ id: bobEntry.id, roomId: room.id }),
				api.bob.live.update({ id: bobEntry.id, assetId: jpy.id }),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await everyRow(api)).toEqual(before);

		for (const error of await Promise.all(
			[
				api.bob.live.create({
					kind: "cash",
					roomId: room.id,
					rule: bobRule,
					payments: [],
				}),
				api.bob.live.create({
					kind: "cash",
					rule: bobRule,
					payments: [real("buy_in", jpy.id, 1)],
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "FORBIDDEN" });
		}
	});

	test("table players keep seat stints, reject occupied seats and undo only their latest change", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const started = await api.alice.live.create({
			kind: "cash",
			startedAt: nowSeconds() - HOUR,
			rule: { ...rule, tableSize: 6 },
			payments: [real("buy_in", jpy.id, 100)],
		});
		const villain = requireCreatedRow(
			await api.alice.player.create({ name: "Villain" })
		);
		const self = await api.alice.player.getSelf();
		const entryId = started.id;

		const joined = await api.alice.tablePlayer.add({
			entryId,
			playerId: villain.id,
			seatPosition: 2,
		});
		await api.alice.tablePlayer.add({
			entryId,
			playerId: self.id,
			seatPosition: 4,
		});
		expect(
			await failure(
				api.alice.tablePlayer.addTemporary({ entryId, seatPosition: 2 })
			)
		).toMatchObject({ code: "CONFLICT" });
		expect(
			await failure(
				api.alice.tablePlayer.add({ entryId, playerId: villain.id })
			)
		).toMatchObject({ code: "CONFLICT" });
		expect(
			await failure(
				api.alice.tablePlayer.addTemporary({ entryId, seatPosition: 6 })
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		const moved = await api.alice.tablePlayer.updateSeat({
			entryId,
			playerId: villain.id,
			seatPosition: 5,
		});
		expect(moved.playerId).toBe(villain.id);
		const stood = await api.alice.tablePlayer.updateSeat({
			entryId,
			playerId: villain.id,
			seatPosition: null,
		});
		const seated = await api.alice.tablePlayer.list({ entryId });
		const villainRow = seated.items.find((item) => item.id === villain.id);
		expect(villainRow).toMatchObject({
			isActive: true,
			seatPosition: null,
			player: { name: "Villain", tags: [] },
		});
		expect(villainRow?.stints.map((stint) => stint.seatPosition)).toEqual([
			2,
			5,
			null,
		]);
		expect(
			seated.items.find((item) => item.id === self.id)?.player.isSelf
		).toBe(true);

		expect(
			await failure(api.alice.playEvent.delete({ id: joined.eventId }))
		).toMatchObject({ code: "CONFLICT" });
		await api.alice.playEvent.delete({ id: stood.eventId });
		expect(
			(
				await api.alice.tablePlayer.list({ entryId, activeOnly: true })
			).items.find((item) => item.id === villain.id)?.seatPosition
		).toBe(5);

		const temporary = await api.alice.tablePlayer.addTemporary({ entryId });
		const removed = await api.alice.tablePlayer.remove({
			entryId,
			playerId: temporary.playerId,
		});
		expect(
			(
				await api.alice.tablePlayer.list({ entryId, activeOnly: true })
			).items.map((item) => item.id)
		).not.toContain(temporary.playerId);
		expect(
			await failure(
				api.alice.playEvent.update({ id: removed.eventId, payload: {} })
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		await api.alice.live.complete({
			id: entryId,
			endState: "cashed_out",
			payments: [],
		});
		expect(
			await failure(api.alice.playEvent.delete({ id: removed.eventId }))
		).toMatchObject({ code: "CONFLICT" });
		expect(
			await failure(
				api.alice.tablePlayer.add({ entryId, playerId: villain.id })
			)
		).toMatchObject({ code: "PRECONDITION_FAILED" });
	});

	test("a manual entry is not a live target", async ({ api }) => {
		const { rule } = await setup(api);
		const manual = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule,
		});
		expect(
			await failure(api.alice.live.getById({ id: manual.id }))
		).toMatchObject({ code: "BAD_REQUEST" });
		expect(
			await failure(
				api.alice.playEvent.create({
					entryId: manual.id,
					eventType: "memo",
					payload: { text: "x" },
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		expect((await api.alice.live.list({})).items).toEqual([]);
	});

	test("live.create with a maximal tournament rule and the payment maximum stays inside the D1 query budget", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const { levels } = await seedMaxRuleLevels(api);
		const created = api.meteredCaller("alice");
		const output = await created.caller.live.create({
			kind: "tournament",
			initialStack: 30_000,
			rule: {
				startingStack: 30_000,
				levels,
				prices: Array.from({ length: MAX_RULE_PRICES }, (_, index) => ({
					kind: "addon" as const,
					assetId: jpy.id,
					amount: index,
					fee: 0,
					chips: 1000,
				})),
			},
			payments: Array.from({ length: MAX_ENTRY_PAYMENTS }, (_, index) =>
				real("buy_in", jpy.id, index + 1)
			),
		});
		expect(output.lines).toHaveLength(MAX_ENTRY_PAYMENTS);
		expect(created.meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
	});
});
