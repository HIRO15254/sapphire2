import type { Database } from "@sapphire2/db";
import type { LedgerRole } from "@sapphire2/db/constants/ledger";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { tournamentRule } from "@sapphire2/db/schema/rule";
import { describe, expect } from "vitest";
import type { EntryOutput } from "../services/entry-reads";
import { MAX_ENTRY_PAYMENTS } from "../services/entry-writes";
import {
	discardLiveEntry,
	startLiveEntry,
	startNextLivePlay,
	undoLiveStartNextPlay,
} from "../services/live-entry";
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
	return { assetId, effect: "real" as const, quantity, role };
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
		await api.alice.asset.create({ kind: "currency", name: "JPY" })
	);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	return { jpy, room, rule };
}

async function everyRow(api: ApiFixture) {
	return {
		entries: await api.db.select().from(entry),
		events: await api.db.select().from(playEvent),
		lines: await api.db.select().from(ledgerLine),
		plays: await api.db.select().from(playSession),
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
	test("rejects a stale projection after a competing event", async ({
		api,
	}) => {
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const raced = api.raceCaller("alice", async () => {
			await api.alice.playEvent.create({
				entryId: started.id,
				eventType: "reentry",
				payload: { payments: [] },
			});
		});
		await expect(
			raced.playEvent.create({
				entryId: started.id,
				eventType: "reentry",
				payload: { payments: [] },
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.db.select().from(playEvent)).filter(
				(e) => e.type === "reentry"
			)
		).toHaveLength(1);
	});

	test("rejects a competing claim on the same seat", async ({ api }) => {
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const first = requireCreatedRow(
			await api.alice.player.create({ name: "First" })
		);
		const second = requireCreatedRow(
			await api.alice.player.create({ name: "Second" })
		);
		const raced = api.raceCaller("alice", async () => {
			await api.alice.tablePlayer.add({
				entryId: started.id,
				playerId: first.id,
				seatPosition: 1,
			});
		});
		await expect(
			raced.tablePlayer.add({
				entryId: started.id,
				playerId: second.id,
				seatPosition: 1,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.tablePlayer.list({ entryId: started.id })).items.map(
				(p) => p.id
			)
		).toEqual([first.id]);
	});

	test("rejects a player event after the player is deleted", async ({
		api,
	}) => {
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const saved = requireCreatedRow(
			await api.alice.player.create({ name: "Opponent" })
		);
		const raced = api.raceCaller("alice", async () => {
			await api.alice.player.delete({ id: saved.id });
		});
		await expect(
			raced.tablePlayer.add({ entryId: started.id, playerId: saved.id })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.tablePlayer.list({ entryId: started.id })).items
		).toEqual([]);
	});

	test("rejects deleting a player referenced by a competing event", async ({
		api,
	}) => {
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const saved = requireCreatedRow(
			await api.alice.player.create({ name: "Opponent" })
		);
		const raced = api.raceCaller("alice", async () => {
			await api.alice.tablePlayer.add({
				entryId: started.id,
				playerId: saved.id,
			});
		});
		await expect(raced.player.delete({ id: saved.id })).rejects.toMatchObject({
			code: "CONFLICT",
			message: "This player cannot be deleted",
		});
		expect(await api.alice.player.getById({ id: saved.id })).toMatchObject({
			id: saved.id,
		});
	});

	test("editing and deleting a reentry reprojects its payment", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const event = await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "reentry",
			payload: { payments: [real("reentry", jpy.id, 1000)] },
		});
		await api.alice.playEvent.update({
			id: event.id,
			payload: { payments: [real("reentry", jpy.id, 2500)] },
		});
		const updated = await api.alice.live.getById({ id: started.id });
		expect(updated.lines).toMatchObject([
			{ assetId: jpy.id, eventId: event.id, quantity: -2500, role: "reentry" },
		]);
		expect(updated.totals).toMatchObject([
			{
				assetId: jpy.id,
				buyIn: 2500,
				cashOut: 0,
				effect: "real",
				profitLoss: -2500,
				roleTotals: { reentry: { lineCount: 1, quantity: -2500 } },
			},
		]);
		await api.alice.playEvent.delete({ id: event.id });
		const deleted = await api.alice.live.getById({ id: started.id });
		expect(deleted.lines).toEqual([]);
		expect(deleted.totals).toEqual([]);
	});

	test("editing an event cannot add new lines for an archived asset", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
		});
		const payment = real("reentry", jpy.id, 1000);
		const event = await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "reentry",
			payload: { payments: [payment] },
		});
		await api.alice.asset.archive({ id: jpy.id });
		await api.alice.playEvent.update({
			id: event.id,
			payload: { payments: [payment] },
		});
		expect(
			await failure(
				api.alice.playEvent.update({
					id: event.id,
					payload: { payments: [payment, payment] },
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		expect(
			(await api.alice.live.getById({ id: started.id })).lines
		).toHaveLength(1);
	});

	test("old prices are retained only by their original event", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
			rule: {
				prices: [
					{
						amount: 5000,
						assetId: jpy.id,
						chips: 30_000,
						fee: 0,
						kind: "addon",
					},
				],
			},
		});
		const priceId = tournamentPrices(started)[0]?.id ?? "";
		const payment = real("chip_purchase", jpy.id, 5000);
		const event = await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "purchase_chips",
			payload: { payments: [payment], priceId },
		});
		const freeEvent = await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "purchase_chips",
			payload: { payments: [], priceId },
		});
		await api.alice.live.overrideRule({
			id: started.id,
			kind: "tournament",
			rule: { startingStack: 12_345 },
		});
		await api.alice.playEvent.update({
			id: event.id,
			payload: { payments: [payment], priceId },
		});
		expect(
			(
				await api.alice.playEvent.update({
					id: freeEvent.id,
					payload: { payments: [], priceId },
				})
			).payload.priceId
		).toBe(priceId);
		expect(
			await failure(
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "purchase_chips",
					payload: { payments: [payment], priceId },
				})
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(
			await failure(
				api.alice.playEvent.update({
					id: event.id,
					payload: { payments: [payment, payment], priceId },
				})
			)
		).toMatchObject({ code: "FORBIDDEN" });
	});

	test("a cash session starts, records events and completes as a settled entry with its profit", async ({
		api,
	}) => {
		const { jpy, room, rule } = await setup(api);
		const startedAt = nowSeconds() - 2 * HOUR;
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 10_000)],
			roomId: room.id,
			rule,
			startedAt,
		});
		expect(started).toMatchObject({
			kind: "cash",
			progress: null,
			source: "live",
			status: "open",
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
			endState: "cashed_out",
			id: started.id,
			occurredAt: startedAt + HOUR,
			payments: [real("cash_out", jpy.id, 22_000)],
		});
		expect(completed.status).toBe("settled");
		expect(completed.playSessions).toMatchObject([
			{ breakMinutes: 10, endState: "cashed_out", status: "ended" },
		]);
		expect(completed.totals).toMatchObject([
			{ assetId: jpy.id, buyIn: 15_000, cashOut: 22_000, effect: "real" },
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
			initialStack: 20_000,
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 10_000), real("fee", jpy.id, 1000)],
			rule: {
				prices: [
					{
						amount: 10_000,
						assetId: jpy.id,
						chips: null,
						fee: 1000,
						kind: "entry",
					},
					{
						amount: 5000,
						assetId: jpy.id,
						chips: 30_000,
						fee: 500,
						kind: "addon",
					},
				],
				startingStack: 20_000,
			},
			startedAt,
		});
		expect(started.progress).toEqual({
			averageStack: null,
			chipTotal: 0,
			currentStack: 20_000,
			remainingPlayers: null,
			totalEntries: null,
		});
		const addon = tournamentPrices(started).find(
			(price) => price.kind === "addon"
		);

		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "update_stack",
			occurredAt: startedAt + 600,
			payload: {
				chipPurchaseCounts: [
					{ chipsPerUnit: 20_000, count: 10, name: "Rebuy" },
				],
				remainingPlayers: 40,
				stackAmount: 25_000,
				totalEntries: 50,
			},
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "purchase_chips",
			occurredAt: startedAt + 1200,
			payload: {
				payments: [
					real("chip_purchase", jpy.id, 5000),
					real("fee", jpy.id, 500),
				],
				priceId: addon?.id ?? "",
			},
		});
		const purchased = await api.alice.live.getById({ id: started.id });
		expect(purchased.events.at(-1)?.payload).toMatchObject({
			chips: 30_000,
			priceId: addon?.id,
		});
		expect(purchased.progress).toEqual({
			averageStack: Math.round((20_000 * 50 + 230_000) / 40),
			chipTotal: 230_000,
			currentStack: 25_000,
			remainingPlayers: 40,
			totalEntries: 50,
		});

		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "update_stack",
			occurredAt: startedAt + 1800,
			payload: { remainingPlayers: null, stackAmount: 40_000 },
		});
		const cleared = await api.alice.live.getById({ id: started.id });
		expect(cleared.progress).toMatchObject({
			averageStack: null,
			currentStack: 40_000,
			remainingPlayers: null,
			totalEntries: 50,
		});

		const completed = await api.alice.live.complete({
			endState: "busted",
			id: started.id,
			occurredAt: startedAt + 2 * HOUR,
			payments: [],
			placement: 12,
			totalEntries: 50,
		});
		expect(completed).toMatchObject({
			status: "settled",
			tournament: { beforeDeadline: false, placement: 12, totalEntries: 50 },
		});
		expect(completed.playSessions[0]?.endState).toBe("busted");
	});

	test("a competing start at batch time leaves one entry and no stray rule", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const input = {
			kind: "tournament" as const,
			payments: [real("buy_in", jpy.id, 1000)],
			rule: { startingStack: 10_000 },
		};
		const racing = new Proxy(api.db, {
			get(target, property, receiver) {
				if (property !== "batch") {
					return Reflect.get(target, property, receiver);
				}
				return async (statements: Parameters<Database["batch"]>[0]) => {
					await startLiveEntry(target, "alice", input, new Date());
					return target.batch(statements);
				};
			},
		});
		expect(
			await failure(startLiveEntry(racing, "alice", input, new Date()))
		).toMatchObject({ code: "CONFLICT" });
		expect(await api.db.select().from(entry)).toHaveLength(1);
		expect(await api.db.select().from(tournamentRule)).toHaveLength(1);
	});
	test("discard cannot delete an entry completed after its status was read", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 100)],
			rule,
		});
		const racing = new Proxy(api.db, {
			get(target, property, receiver) {
				if (property !== "delete") {
					return Reflect.get(target, property, receiver);
				}
				return () => {
					const deleting = target.delete(entry);
					return {
						where(condition: Parameters<typeof deleting.where>[0]) {
							const query = deleting.where(condition);
							return {
								async returning() {
									await api.alice.live.complete({
										endState: "cashed_out",
										id: started.id,
										payments: [real("cash_out", jpy.id, 150)],
									});
									return await query.returning({ id: entry.id });
								},
							};
						},
					};
				};
			},
		});
		expect(
			await failure(discardLiveEntry(racing, "alice", started.id))
		).toMatchObject({ code: "PRECONDITION_FAILED" });
		const retained = await api.alice.live.getById({ id: started.id });
		expect(retained.status).toBe("settled");
		expect(retained.lines).toHaveLength(2);
	});

	test("the start date is read in the user's time zone, Asia/Tokyo when unset, unless given", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const startedAt = Date.UTC(2025, 0, 10, 16) / 1000;
		const startOn = async (localDate?: string) => {
			const started = await api.alice.live.create({
				kind: "cash",
				localDate,
				payments: [real("buy_in", jpy.id, 100)],
				rule,
				startedAt,
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
					payments: [],
					rule,
					startedAt: nowSeconds() + 600,
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		const startedAt = nowSeconds() - HOUR;
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 100)],
			rule,
			startedAt,
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
					endState: "cashed_out",
					id: started.id,
					occurredAt: startedAt + 600,
					payments: [],
				}),
				api.alice.live.complete({
					endState: "busted",
					id: started.id,
					payments: [],
				}),
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "purchase_chips",
					payload: { payments: [], priceId: "price" },
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "BAD_REQUEST" });
		}
		expect(await everyRow(api)).toEqual(before);

		await api.alice.live.complete({
			endState: "cashed_out",
			id: started.id,
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
					endState: "cashed_out",
					id: started.id,
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
			payments: [],
			rule: {
				prices: [
					{ amount: 100, assetId: jpy.id, chips: 10, fee: 0, kind: "addon" },
				],
			},
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
					beforeDeadline: true,
					endState: "busted",
					id: aliceEntry.id,
					payments: [],
				}),
				api.bob.live.endPlay({
					endState: "bagged",
					id: aliceEntry.id,
					stackAmount: 1000,
				}),
				api.bob.live.startNextPlay({ id: aliceEntry.id }),
				api.bob.live.undoEndPlay({ id: aliceEntry.id }),
				api.bob.live.undoStartNextPlay({ id: aliceEntry.id }),
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
					eventType: "memo",
					payload: { text: "x" },
					playSessionId: aliceEntry.playSessions[0]?.id,
				}),
				api.bob.playEvent.create({
					entryId: bobEntry.id,
					eventType: "purchase_chips",
					payload: { payments: [], priceId },
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
				api.bob.live.update({ assetId: jpy.id, id: bobEntry.id }),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await everyRow(api)).toEqual(before);

		for (const error of await Promise.all(
			[
				api.bob.live.create({
					kind: "cash",
					payments: [],
					roomId: room.id,
					rule: bobRule,
				}),
				api.bob.live.create({
					kind: "cash",
					payments: [real("buy_in", jpy.id, 1)],
					rule: bobRule,
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "FORBIDDEN" });
		}
	});

	test("a player added at the table keeps its tags in order for the player and table reads", async ({
		api,
	}) => {
		const { rule } = await setup(api);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [],
			rule,
		});
		const tagIds = await api.createPlayerTags("alice", 2);
		const ordered = tagIds.toReversed();
		const added = await api.alice.tablePlayer.addNew({
			entryId: started.id,
			playerName: "Reg",
			playerTagIds: ordered,
		});

		const saved = await api.alice.player.getById({ id: added.playerId });
		expect(saved.tags.map((tag) => tag.id)).toEqual(ordered);
		const seated = await api.alice.tablePlayer.list({ entryId: started.id });
		expect(
			seated.items
				.find((item) => item.id === added.playerId)
				?.player.tags.map((tag) => tag.id)
		).toEqual(ordered);
	});

	test("table players keep seat stints, reject occupied seats and undo only their latest change", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [real("buy_in", jpy.id, 100)],
			rule: { ...rule, tableSize: 6 },
			startedAt: nowSeconds() - HOUR,
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
			player: { name: "Villain", tags: [] },
			seatPosition: null,
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
				await api.alice.tablePlayer.list({ activeOnly: true, entryId })
			).items.find((item) => item.id === villain.id)?.seatPosition
		).toBe(5);

		const temporary = await api.alice.tablePlayer.addTemporary({ entryId });
		const removed = await api.alice.tablePlayer.remove({
			entryId,
			playerId: temporary.playerId,
		});
		expect(
			(
				await api.alice.tablePlayer.list({ activeOnly: true, entryId })
			).items.map((item) => item.id)
		).not.toContain(temporary.playerId);
		expect(
			await failure(
				api.alice.playEvent.update({ id: removed.eventId, payload: {} })
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		await api.alice.live.complete({
			endState: "cashed_out",
			id: entryId,
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
			initialStack: 30_000,
			kind: "tournament",
			payments: Array.from({ length: MAX_ENTRY_PAYMENTS }, (_, index) =>
				real("buy_in", jpy.id, index + 1)
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
				startingStack: 30_000,
			},
		});
		expect(output.lines).toHaveLength(MAX_ENTRY_PAYMENTS);
		expect(created.meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
	});
});

function linesOf(output: EntryOutput) {
	return output.lines.map(({ role, quantity, playSessionId }) => ({
		playSessionId,
		quantity,
		role,
	}));
}

async function rowsWithoutWriteTimes(api: ApiFixture) {
	const rows = await everyRow(api);
	return {
		entries: rows.entries.map(({ updatedAt: _, ...row }) => row),
		events: rows.events,
		lines: rows.lines.map((line) => line.id),
		plays: rows.plays.map(({ updatedAt: _, ...row }) => row),
	};
}

describe("live multi-day API on D1", () => {
	test("re-entry cannot be written or moved into a paused interval", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const startedAt = nowSeconds() - HOUR;
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [],
			startedAt,
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "session_pause",
			occurredAt: startedAt + 10,
			payload: {},
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "session_resume",
			occurredAt: startedAt + 30,
			payload: {},
		});
		const payment = real("reentry", jpy.id, 1000);
		const reentry = await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "reentry",
			occurredAt: startedAt + 40,
			payload: { payments: [payment] },
		});
		const before = await everyRow(api);
		expect(
			await failure(
				api.alice.playEvent.create({
					entryId: started.id,
					eventType: "reentry",
					occurredAt: startedAt + 20,
					payload: { payments: [payment] },
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		expect(
			await failure(
				api.alice.playEvent.update({
					id: reentry.id,
					occurredAt: startedAt + 20,
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		expect(await everyRow(api)).toEqual(before);
	});

	test("a tournament busts on Day 1A, re-enters on Day 1C, bags and busts on Day 2", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const t0 = nowSeconds() - 30 * HOUR;
		const day1a = await api.alice.live.create({
			kind: "tournament",
			label: "Day 1A",
			localDate: "2026-11-01",
			payments: [real("buy_in", jpy.id, 10_000), real("fee", jpy.id, 1000)],
			rule: { startingStack: 20_000 },
			startedAt: t0,
		});
		const busted = await api.alice.live.complete({
			beforeDeadline: true,
			endState: "busted",
			id: day1a.id,
			occurredAt: t0 + HOUR,
			payments: [],
		});
		expect(busted.status).toBe("settled");

		const day1c = await api.alice.live.startNextPlay({
			id: day1a.id,
			label: "Day 1C",
			localDate: "2026-11-01",
			payments: [real("reentry", jpy.id, 10_000), real("fee", jpy.id, 1000)],
			startedAt: t0 + 2 * HOUR,
			startLevel: 5,
		});
		const day1cId = day1c.playSessions[1]?.id;
		expect(day1c.status).toBe("open");
		expect(day1c.playSessions).toMatchObject([
			{ endState: "busted", label: "Day 1A", seq: 1, status: "ended" },
			{
				clockStartLevel: 5,
				endState: null,
				label: "Day 1C",
				seq: 2,
				status: "active",
			},
		]);
		expect(linesOf(day1c).filter((line) => line.role === "reentry")).toEqual([
			{ playSessionId: day1cId, quantity: -10_000, role: "reentry" },
		]);

		await api.alice.playEvent.create({
			entryId: day1a.id,
			eventType: "session_pause",
			occurredAt: t0 + 2 * HOUR + 1800,
			payload: {},
		});
		const bagged = await api.alice.live.endPlay({
			endState: "bagged",
			id: day1a.id,
			occurredAt: t0 + 4 * HOUR,
			stackAmount: 55_000,
		});
		expect(bagged.status).toBe("open");
		expect(bagged.playSessions[1]).toMatchObject({
			breakMinutes: 90,
			endStack: 55_000,
			endState: "bagged",
			status: "ended",
		});
		for (const error of await Promise.all(
			[
				api.alice.playEvent.create({
					entryId: day1a.id,
					eventType: "session_resume",
					payload: {},
				}),
				api.alice.playEvent.create({
					entryId: day1a.id,
					eventType: "memo",
					payload: { text: "late" },
				}),
			].map(failure)
		)) {
			expect(error).toMatchObject({ code: "PRECONDITION_FAILED" });
		}
		expect(
			await failure(
				api.alice.live.startNextPlay({
					id: day1a.id,
					payments: [real("reentry", jpy.id, 10_000)],
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		await api.alice.live.startNextPlay({
			id: day1a.id,
			label: "Day 2",
			localDate: "2026-11-02",
			startedAt: t0 + 24 * HOUR,
		});
		const final = await api.alice.live.complete({
			endState: "busted",
			id: day1a.id,
			occurredAt: t0 + 27 * HOUR,
			payments: [real("prize", jpy.id, 50_000)],
			placement: 12,
			totalEntries: 300,
		});
		expect(final).toMatchObject({
			playedOn: "2026-11-01",
			playMinutes: 60 + 30 + 180,
			status: "settled",
			tournament: { beforeDeadline: false, placement: 12, totalEntries: 300 },
		});
		expect(final.playSessions.map((play) => play.endState)).toEqual([
			"busted",
			"bagged",
			"busted",
		]);
		expect(
			linesOf(final).map(({ role, quantity }) => [role, quantity])
		).toEqual([
			["buy_in", -10_000],
			["fee", -1000],
			["reentry", -10_000],
			["fee", -1000],
			["prize", 50_000],
		]);
		expect(final.totals[0]?.profitLoss).toBe(50_000 - 22_000);
	});

	test("a cash day is held, resumed as a new day and cashed out; continuing then needs undoEndPlay", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const t0 = nowSeconds() - 30 * HOUR;
		const started = await api.alice.live.create({
			kind: "cash",
			localDate: "2026-11-01",
			payments: [real("buy_in", jpy.id, 10_000)],
			rule,
			startedAt: t0,
		});
		const { id } = started;
		await api.alice.playEvent.create({
			entryId: id,
			eventType: "session_pause",
			occurredAt: t0 + HOUR,
			payload: {},
		});
		const held = await api.alice.live.endPlay({
			endState: "held",
			id,
			occurredAt: t0 + 2 * HOUR,
			stackAmount: 12_000,
		});
		expect(held).toMatchObject({ status: "open", totals: [{ cashOut: 0 }] });
		expect(held.playSessions[0]).toMatchObject({
			breakMinutes: 60,
			endStack: 12_000,
			endState: "held",
			status: "ended",
		});

		for (const input of [
			{ id, startedAt: t0 + HOUR },
			{ id, startLevel: 2 },
			{ id, payments: [real("reentry", jpy.id, 100)] },
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
			expect(await failure(api.alice.live.startNextPlay(input))).toMatchObject({
				code: "BAD_REQUEST",
			});
		}
		await api.alice.live.startNextPlay({
			id,
			localDate: "2026-11-02",
			startedAt: t0 + 20 * HOUR,
		});
		const cashed = await api.alice.live.complete({
			endState: "cashed_out",
			id,
			occurredAt: t0 + 22 * HOUR,
			payments: [real("cash_out", jpy.id, 15_000)],
		});
		expect(cashed).toMatchObject({
			playMinutes: 60 + 120,
			status: "settled",
			totals: [{ buyIn: 10_000, cashOut: 15_000, profitLoss: 5000 }],
		});

		expect(await failure(api.alice.live.startNextPlay({ id }))).toMatchObject({
			code: "PRECONDITION_FAILED",
		});
		const reopened = await api.alice.live.undoEndPlay({ id });
		expect(reopened).toMatchObject({
			status: "open",
			totals: [{ cashOut: 0, profitLoss: -10_000 }],
		});
		expect(reopened.playSessions[1]).toMatchObject({
			endedAt: null,
			endState: null,
			status: "active",
		});
	});

	test("a finished tournament cannot continue but undoEndPlay reverts a mistaken finish", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 1000)],
			startedAt: nowSeconds() - HOUR,
		});
		await api.alice.live.complete({
			endState: "finished",
			id: started.id,
			payments: [real("prize", jpy.id, 5000)],
			placement: 1,
			totalEntries: 9,
		});
		expect(
			await failure(api.alice.live.startNextPlay({ id: started.id }))
		).toMatchObject({ code: "PRECONDITION_FAILED" });

		const reverted = await api.alice.live.undoEndPlay({ id: started.id });
		expect(reverted).toMatchObject({
			status: "open",
			tournament: { beforeDeadline: false, placement: null },
		});
		expect(reverted.lines.map((line) => line.role)).toEqual(["buy_in"]);
		expect(
			await failure(api.alice.live.undoEndPlay({ id: started.id }))
		).toMatchObject({ code: "CONFLICT" });
	});

	test("endPlay rejects a wrong-kind state, a future time and an end before the day's last event without writes", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const startedAt = nowSeconds() - HOUR;
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 1000)],
			startedAt,
		});
		await api.alice.playEvent.create({
			entryId: started.id,
			eventType: "memo",
			occurredAt: startedAt + 1800,
			payload: { text: "Level 5" },
		});
		const before = await everyRow(api);
		for (const input of [
			{ endState: "held" as const },
			{ occurredAt: nowSeconds() + 600 },
			{ occurredAt: startedAt + 600 },
		]) {
			expect(
				// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
				await failure(
					api.alice.live.endPlay({
						endState: "bagged",
						id: started.id,
						stackAmount: 1000,
						...input,
					})
				)
			).toMatchObject({ code: "BAD_REQUEST" });
		}
		expect(await everyRow(api)).toEqual(before);
	});

	test("undoStartNextPlay removes the re-entry payment with the empty day and refuses a day with events or hands", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 1000)],
			startedAt: nowSeconds() - 2 * HOUR,
		});
		const { id } = started;
		expect(
			await failure(api.alice.live.undoStartNextPlay({ id }))
		).toMatchObject({ code: "CONFLICT" });
		await api.alice.live.complete({
			beforeDeadline: true,
			endState: "busted",
			id,
			occurredAt: nowSeconds() - HOUR,
			payments: [],
		});
		const beforeNext = await rowsWithoutWriteTimes(api);

		const bobAsset = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Bob JPY" })
		);
		expect(
			await failure(
				api.alice.live.startNextPlay({
					id,
					payments: [real("reentry", bobAsset.id, 1000)],
				})
			)
		).toMatchObject({ code: "FORBIDDEN" });
		expect(await rowsWithoutWriteTimes(api)).toEqual(beforeNext);

		await api.alice.live.startNextPlay({
			id,
			payments: [real("reentry", jpy.id, 1000), real("fee", jpy.id, 100)],
		});
		const undone = await api.alice.live.undoStartNextPlay({ id });
		expect(undone).toMatchObject({
			playSessions: [{ endState: "busted", seq: 1 }],
			status: "settled",
		});
		expect(await rowsWithoutWriteTimes(api)).toEqual(beforeNext);

		const next = await api.alice.live.startNextPlay({ id });
		const memo = await api.alice.playEvent.create({
			entryId: id,
			eventType: "memo",
			payload: { text: "Seat 4" },
		});
		expect(
			await failure(api.alice.live.undoStartNextPlay({ id }))
		).toMatchObject({ code: "CONFLICT" });
		await api.alice.playEvent.delete({ id: memo.id });
		await api.alice.hand.add({ playSessionId: next.playSessions[1]?.id ?? "" });
		expect(
			await failure(api.alice.live.undoStartNextPlay({ id }))
		).toMatchObject({ code: "CONFLICT" });
		expect((await api.alice.live.getById({ id })).playSessions).toHaveLength(2);
	});

	test("undoing a next day preserves a hand added before its batch", async ({
		api,
	}) => {
		const { jpy } = await setup(api);
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 1000)],
		});
		await api.alice.live.complete({
			beforeDeadline: true,
			endState: "busted",
			id: started.id,
			payments: [],
		});
		const next = await api.alice.live.startNextPlay({
			id: started.id,
			payments: [real("reentry", jpy.id, 1000)],
		});
		const playSessionId = next.playSessions[1]?.id ?? "";
		let beforeBatch: string | undefined;
		const racing = new Proxy(api.db, {
			get(target, property, receiver) {
				if (property !== "batch") {
					return Reflect.get(target, property, receiver);
				}
				return async (statements: Parameters<Database["batch"]>[0]) => {
					await api.alice.hand.add({ playSessionId });
					beforeBatch = JSON.stringify(await everyRow(api));
					return target.batch(statements);
				};
			},
		});
		expect(
			await failure(
				undoLiveStartNextPlay(racing, "alice", started.id, new Date())
			)
		).toMatchObject({ code: "CONFLICT" });
		expect(beforeBatch).toBeDefined();
		expect(JSON.stringify(await everyRow(api))).toBe(beforeBatch);
		expect((await api.alice.hand.list({ playSessionId })).items).toHaveLength(
			1
		);
	});

	test("concurrent next-day starts and an undo against another live play leave one unfinished play", async ({
		api,
	}) => {
		const { jpy, rule } = await setup(api);
		const first = await api.alice.live.create({
			kind: "tournament",
			payments: [real("buy_in", jpy.id, 1000)],
			startedAt: nowSeconds() - HOUR,
		});
		await api.alice.live.complete({
			beforeDeadline: true,
			endState: "busted",
			id: first.id,
			payments: [],
		});
		const racing = new Proxy(api.db, {
			get(target, property, receiver) {
				if (property !== "batch") {
					return Reflect.get(target, property, receiver);
				}
				return async (statements: Parameters<Database["batch"]>[0]) => {
					await startNextLivePlay(
						target,
						"alice",
						{ id: first.id },
						new Date()
					);
					return target.batch(statements);
				};
			},
		});
		expect(
			await failure(
				startNextLivePlay(racing, "alice", { id: first.id }, new Date())
			)
		).toMatchObject({ code: "CONFLICT" });
		expect(await api.db.select().from(playSession)).toHaveLength(2);

		await api.alice.live.endPlay({
			endState: "bagged",
			id: first.id,
			stackAmount: 5000,
		});
		await api.alice.live.create({ kind: "cash", payments: [], rule });
		expect(
			await failure(api.alice.live.undoEndPlay({ id: first.id }))
		).toMatchObject({ code: "CONFLICT" });
		expect(
			await failure(api.alice.live.startNextPlay({ id: first.id }))
		).toMatchObject({ code: "CONFLICT" });
	});
});
