import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { cashRule, tournamentRule } from "@sapphire2/db/schema/rule";
import { MAX_LINKED_TAGS } from "@sapphire2/db/schemas/tag-ids";
import { inArray } from "drizzle-orm";
import { describe, expect } from "vitest";
import type { EntryOutput } from "../services/entry-reads";
import { MAX_RULE_LEVELS, MAX_RULE_PRICES } from "../services/tournament-rule";
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
const BUDGET = D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE;

async function failure(promise: Promise<unknown>) {
	return await promise.then(
		() => {
			throw new Error("expected the call to fail");
		},
		(error: unknown) => error
	);
}

function ruleState(output: EntryOutput) {
	return {
		currentMasterRuleId: output.currentMasterRuleId,
		ringGameId: output.ringGameId,
		ruleDrift: output.ruleDrift,
		ruleVersion: output.ruleVersion,
		ruleVersionId: output.ruleVersionId,
		tournamentId: output.tournamentId,
	};
}

function withoutIds(output: EntryOutput) {
	if (output.kind !== "tournament") {
		throw new Error("expected a tournament entry");
	}
	const { levels, prices, startingStack, tableSize } = output.ruleVersion;
	return {
		levels: levels.map(({ id: _id, ...level }) => level),
		prices: prices.map(({ id: _id, ...price }) => price),
		startingStack,
		tableSize,
	};
}

async function cashSetup(api: ApiFixture) {
	const rule = await nlhGame(api.db);
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const ringA = await api.alice.ringGame.create({
		name: "A",
		roomId: room.id,
		rule: { ...rule, minBuyIn: 100, tableSize: 9 },
	});
	const ringB = await api.alice.ringGame.create({
		name: "B",
		roomId: room.id,
		rule: { ...rule, minBuyIn: 300, tableSize: 6 },
	});
	return { ringA, ringB, room, rule };
}

async function cashVersions(api: ApiFixture) {
	return await api.db.select().from(cashRule).orderBy(cashRule.id);
}

describe("entry rule operations on D1", () => {
	test("rejects a rule change when a concurrent seat move no longer fits", async ({
		api,
	}) => {
		const { ringA } = await cashSetup(api);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [
				{ assetId: jpy.id, effect: "real", quantity: 100, role: "buy_in" },
			],
			ringGameId: ringA.id,
			startedAt: Math.floor(Date.now() / 1000) - HOUR,
		});
		const player = requireCreatedRow(
			await api.alice.player.create({ name: "Villain" })
		);
		await api.alice.tablePlayer.add({
			entryId: started.id,
			playerId: player.id,
			seatPosition: 2,
		});
		const raced = api.raceCaller("alice", async () => {
			await api.alice.tablePlayer.updateSeat({
				entryId: started.id,
				playerId: player.id,
				seatPosition: 7,
			});
		});
		await expect(
			raced.live.overrideRule({
				id: started.id,
				kind: "cash",
				rule: { tableSize: 6 },
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.live.getById({ id: started.id })).ruleVersionId
		).toBe(started.ruleVersionId);
	});

	test("rejects a seat add when a concurrent rule change shrinks the table", async ({
		api,
	}) => {
		const { ringA } = await cashSetup(api);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [
				{ assetId: jpy.id, effect: "real", quantity: 100, role: "buy_in" },
			],
			ringGameId: ringA.id,
			startedAt: Math.floor(Date.now() / 1000) - HOUR,
		});
		const player = requireCreatedRow(
			await api.alice.player.create({ name: "Villain" })
		);
		const raced = api.raceCaller("alice", async () => {
			await api.alice.live.overrideRule({
				id: started.id,
				kind: "cash",
				rule: { tableSize: 6 },
			});
		});
		await expect(
			raced.tablePlayer.add({
				entryId: started.id,
				playerId: player.id,
				seatPosition: 7,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.live.getById({ id: started.id })).ruleVersion.tableSize
		).toBe(6);
	});

	test("override, apply, push and relink repoint versions by id, and restoreRule returns ids, drift and content to the previous state", async ({
		api,
	}) => {
		const { room, ringA, ringB } = await cashSetup(api);
		const currentOf = async (id: string) =>
			(await api.alice.ringGame.listByRoom({ roomId: room.id })).find(
				(row) => row.id === id
			)?.currentRuleId;
		const created = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			ringGameId: ringA.id,
		});
		const id = created.id;
		expect(ruleState(created)).toMatchObject({
			ringGameId: ringA.id,
			ruleDrift: false,
			ruleVersionId: ringA.currentRuleId,
		});
		const linked = ruleState(created);

		const unchanged = await api.alice.entry.overrideRule({
			id,
			kind: "cash",
			rule: { minBuyIn: 100 },
		});
		expect(unchanged.ruleVersionId).toBe(ringA.currentRuleId);

		const overridden = await api.alice.entry.overrideRule({
			id,
			kind: "cash",
			rule: { minBuyIn: 200 },
		});
		expect(overridden).toMatchObject({
			currentMasterRuleId: ringA.currentRuleId,
			ringGameId: ringA.id,
			ruleDrift: true,
			ruleVersion: {
				minBuyIn: 200,
				parentRuleId: ringA.currentRuleId,
				ringGameId: ringA.id,
				tableSize: 9,
			},
		});
		const child = ruleState(overridden);
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id,
					masterId: ringA.id,
					ruleVersionId: linked.ruleVersionId,
				})
			)
		).toEqual(linked);
		await api.alice.entry.restoreRule({
			id,
			masterId: ringA.id,
			ruleVersionId: child.ruleVersionId,
		});

		const applied = await api.alice.entry.applyMasterRule({ id });
		expect(ruleState(applied)).toEqual(linked);
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id,
					masterId: ringA.id,
					ruleVersionId: child.ruleVersionId,
				})
			)
		).toEqual(child);

		const pushed = await api.alice.entry.pushRuleToMaster({ id });
		expect(pushed).toMatchObject({
			currentMasterRuleId: child.ruleVersionId,
			ruleDrift: false,
			ruleVersionId: child.ruleVersionId,
		});
		expect(await currentOf(ringA.id)).toBe(child.ruleVersionId);
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id,
					masterId: ringA.id,
					masterRuleVersionId: ringA.currentRuleId,
					ruleVersionId: child.ruleVersionId,
				})
			)
		).toEqual(child);
		expect(await currentOf(ringA.id)).toBe(ringA.currentRuleId);

		const before = await cashVersions(api);
		const kept = await api.alice.entry.relink({
			id,
			keepRule: true,
			ringGameId: ringB.id,
		});
		expect(kept).toMatchObject({
			currentMasterRuleId: ringB.currentRuleId,
			ringGameId: ringB.id,
			ruleDrift: true,
			ruleVersion: {
				minBuyIn: 200,
				parentRuleId: ringB.currentRuleId,
				ringGameId: ringB.id,
				tableSize: 9,
			},
		});
		expect(kept.ruleVersionId).not.toBe(child.ruleVersionId);
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id,
					masterId: ringA.id,
					ruleVersionId: child.ruleVersionId,
				})
			)
		).toEqual(child);

		const adopted = await api.alice.entry.relink({
			id,
			keepRule: false,
			ringGameId: ringB.id,
		});
		expect(adopted).toMatchObject({
			ringGameId: ringB.id,
			ruleDrift: false,
			ruleVersionId: ringB.currentRuleId,
		});
		await api.alice.entry.restoreRule({
			id,
			masterId: ringA.id,
			ruleVersionId: child.ruleVersionId,
		});

		const unlinked = await api.alice.entry.relink({
			id,
			keepRule: true,
			ringGameId: null,
		});
		expect(unlinked).toMatchObject({
			currentMasterRuleId: null,
			ringGameId: null,
			ruleDrift: false,
			ruleVersion: { minBuyIn: 200, parentRuleId: null, ringGameId: null },
		});
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id,
					masterId: ringA.id,
					ruleVersionId: child.ruleVersionId,
				})
			)
		).toEqual(child);

		const after = await cashVersions(api);
		expect(
			after.filter((row) => before.some((old) => old.id === row.id))
		).toEqual(before);
		expect(
			after
				.filter((row) => !before.some((old) => old.id === row.id))
				.map((row) => [row.ringGameId, row.parentRuleId])
				.sort()
		).toEqual(
			[
				[ringB.id, ringB.currentRuleId],
				[null, null],
			].sort()
		);
	});

	test("relink permits an existing archived master but rejects selecting another archived master", async ({
		api,
	}) => {
		const { ringA, ringB } = await cashSetup(api);
		const created = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			ringGameId: ringA.id,
		});
		await api.alice.ringGame.archive({ id: ringA.id });
		await api.alice.ringGame.archive({ id: ringB.id });
		const kept = await api.alice.entry.relink({
			id: created.id,
			keepRule: true,
			ringGameId: ringA.id,
		});
		expect(kept.ruleVersionId).toBe(created.ruleVersionId);
		await expect(
			api.alice.entry.relink({
				id: created.id,
				keepRule: true,
				ringGameId: ringB.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("relink rejects copying cash and tournament stakes that no longer meet blind requirements", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		const nlhRule = await nlhGame(api.db);
		const group = requireCreatedRow(
			await api.alice.gameGroup.create({
				blind1Label: "Small",
				blind2Label: "Big",
				label: "Custom",
			})
		);
		const variant = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: group.id,
				label: "Custom game",
			})
		);
		const stake = { blind2: 2, gameGroupId: group.id };
		const ring = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: nlhRule,
		});
		const tournament = await api.alice.tournament.create({
			name: "MTT",
			roomId: room.id,
			rule: {},
		});
		const cash = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule: { game: { variantId: variant.id }, stakes: [stake] },
		});
		const mtt = await api.alice.entry.create({
			kind: "tournament",
			playedOn: "2026-09-01",
			rule: {
				game: { variantId: variant.id },
				levels: [{ isBreak: false, minutes: 20, stakes: [stake] }],
			},
		});
		await api.alice.gameGroup.update({ blind1Required: true, id: group.id });
		await expect(
			api.alice.entry.relink({
				id: cash.id,
				keepRule: true,
				ringGameId: ring.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.entry.relink({
				id: mtt.id,
				keepRule: true,
				tournamentId: tournament.id,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect((await api.alice.entry.getById({ id: cash.id })).ruleVersionId).toBe(
			cash.ruleVersionId
		);
		expect((await api.alice.entry.getById({ id: mtt.id })).ruleVersionId).toBe(
			mtt.ruleVersionId
		);
	});

	test("replacement payments cannot add uses of an old rule price", async ({
		api,
	}) => {
		const asset = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		const master = await api.alice.tournament.create({
			name: "Main",
			roomId: room.id,
			rule: {
				prices: [
					{
						amount: 1000,
						assetId: asset.id,
						chips: null,
						fee: 0,
						kind: "entry",
					},
				],
			},
		});
		const priceId = master.ruleVersion.prices[0]?.id ?? "";
		const payment = {
			assetId: asset.id,
			effect: "real" as const,
			priceId,
			quantity: 1000,
			role: "buy_in" as const,
		};
		const created = await api.alice.entry.create({
			kind: "tournament",
			payments: [payment],
			playedOn: "2026-09-01",
			tournamentId: master.id,
		});
		await api.alice.entry.overrideRule({
			id: created.id,
			kind: "tournament",
			rule: { startingStack: 30_000 },
		});
		const kept = await api.alice.entry.update({
			id: created.id,
			payments: [payment],
		});
		expect(kept.lines).toHaveLength(1);
		expect(kept.lines[0]?.priceId).toBe(priceId);
		await expect(
			api.alice.entry.update({
				id: created.id,
				payments: [payment, payment],
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(
			(await api.alice.entry.getById({ id: created.id })).lines
		).toHaveLength(1);
	});

	test("tournament override, push and keepRule relink keep paid price references on the earlier version and copy levels and prices under the new master", async ({
		api,
	}) => {
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		const nlh = await nlhGame(api.db);
		const rule = {
			levels: [
				{ isBreak: false, minutes: 20, stakes: nlh.stakes },
				{ isBreak: true, minutes: 10 },
			],
			prices: [
				{
					amount: 1000,
					assetId: jpy.id,
					chips: 20_000,
					fee: 100,
					kind: "entry" as const,
				},
			],
			startingStack: 20_000,
		};
		const main = await api.alice.tournament.create({
			name: "Main",
			roomId: room.id,
			rule,
		});
		const side = await api.alice.tournament.create({
			name: "Side",
			roomId: room.id,
			rule: {},
		});
		const priceId = main.ruleVersion.prices[0]?.id ?? "";
		const created = await api.alice.entry.create({
			kind: "tournament",
			payments: [
				{
					assetId: jpy.id,
					effect: "real",
					priceId,
					quantity: 1000,
					role: "buy_in",
				},
			],
			playedOn: "2026-09-01",
			tournamentId: main.id,
		});
		const id = created.id;

		const overridden = await api.alice.entry.overrideRule({
			id,
			kind: "tournament",
			rule: { startingStack: 30_000 },
		});
		expect(overridden).toMatchObject({
			ruleDrift: true,
			ruleVersion: {
				parentRuleId: main.currentRuleId,
				startingStack: 30_000,
				tournamentId: main.id,
			},
		});
		expect(overridden.lines[0]?.priceId).toBe(priceId);
		expect(withoutIds(overridden).prices).toEqual(withoutIds(created).prices);
		expect(withoutIds(overridden).levels).toEqual(withoutIds(created).levels);

		const pushed = await api.alice.entry.pushRuleToMaster({ id });
		expect(pushed).toMatchObject({
			ruleDrift: false,
			ruleVersionId: overridden.ruleVersionId,
		});
		expect(
			(await api.alice.tournament.getById({ id: main.id })).currentRuleId
		).toBe(overridden.ruleVersionId);

		const kept = await api.alice.entry.relink({
			id,
			keepRule: true,
			tournamentId: side.id,
		});
		expect(kept).toMatchObject({
			ruleDrift: true,
			ruleVersion: { parentRuleId: side.currentRuleId, tournamentId: side.id },
			tournamentId: side.id,
		});
		expect(withoutIds(kept)).toEqual(withoutIds(overridden));
		expect(kept.lines[0]?.priceId).toBe(priceId);
		const [paid] = await api.db
			.select({ priceId: ledgerLine.priceId })
			.from(ledgerLine)
			.where(inArray(ledgerLine.entryId, [id]));
		expect(paid?.priceId).toBe(priceId);

		const restored = await api.alice.entry.restoreRule({
			id,
			masterId: main.id,
			masterRuleVersionId: main.currentRuleId,
			ruleVersionId: overridden.ruleVersionId,
		});
		expect(ruleState(restored)).toEqual(ruleState(overridden));
		expect(
			(await api.alice.tournament.getById({ id: main.id })).currentRuleId
		).toBe(main.currentRuleId);
		expect(
			(
				await api.db
					.select({ tournamentId: tournamentRule.tournamentId })
					.from(tournamentRule)
					.where(inArray(tournamentRule.id, [kept.ruleVersionId]))
			)[0]?.tournamentId
		).toBe(side.id);
	});

	test("rule operations validate kind, link, membership and archived selection before writing", async ({
		api,
	}) => {
		const { rule, ringA, ringB } = await cashSetup(api);
		const standalone = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule: { ...rule, minBuyIn: 50 },
		});
		const linked = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			ringGameId: ringA.id,
		});
		const bobRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Bob" })
		);
		const bobRing = await api.bob.ringGame.create({
			name: "Bob",
			roomId: bobRoom.id,
			rule: await nlhGame(api.db, "bob"),
		});
		const before = await cashVersions(api);

		const rejected = [
			[
				() => api.alice.entry.applyMasterRule({ id: standalone.id }),
				"PRECONDITION_FAILED",
			],
			[
				() => api.alice.entry.pushRuleToMaster({ id: standalone.id }),
				"PRECONDITION_FAILED",
			],
			[
				() =>
					api.alice.entry.overrideRule({
						id: linked.id,
						kind: "tournament",
						rule: {},
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.relink({
						id: linked.id,
						keepRule: true,
						tournamentId: null,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.relink({
						id: linked.id,
						keepRule: false,
						ringGameId: bobRing.id,
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.alice.entry.restoreRule({
						id: linked.id,
						masterId: ringA.id,
						ruleVersionId: ringB.currentRuleId,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.restoreRule({
						id: linked.id,
						masterId: null,
						ruleVersionId: ringA.currentRuleId,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.restoreRule({
						id: standalone.id,
						masterId: null,
						masterRuleVersionId: ringA.currentRuleId,
						ruleVersionId: standalone.ruleVersionId,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.restoreRule({
						id: linked.id,
						masterId: ringA.id,
						masterRuleVersionId: ringB.currentRuleId,
						ruleVersionId: ringA.currentRuleId,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.entry.restoreRule({
						id: linked.id,
						masterId: bobRing.id,
						ruleVersionId: bobRing.currentRuleId,
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.bob.entry.restoreRule({
						id: linked.id,
						masterId: ringA.id,
						ruleVersionId: ringA.currentRuleId,
					}),
				"FORBIDDEN",
			],
			[() => api.alice.live.applyMasterRule({ id: linked.id }), "BAD_REQUEST"],
		] as const;
		for (const [call, code] of rejected) {
			expect(await failure(call())).toMatchObject({ code });
		}

		await api.alice.ringGame.archive({ id: ringB.id });
		expect(
			await failure(
				api.alice.entry.relink({
					id: linked.id,
					keepRule: false,
					ringGameId: ringB.id,
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });
		expect(await cashVersions(api)).toEqual(before);
		expect(ruleState(await api.alice.entry.getById({ id: linked.id }))).toEqual(
			ruleState(linked)
		);

		await api.alice.ringGame.restore({ id: ringB.id });
		await api.alice.entry.relink({
			id: linked.id,
			keepRule: false,
			ringGameId: ringB.id,
		});
		await api.alice.ringGame.archive({ id: ringA.id });
		expect(
			ruleState(
				await api.alice.entry.restoreRule({
					id: linked.id,
					masterId: ringA.id,
					ruleVersionId: ringA.currentRuleId,
				})
			)
		).toEqual(ruleState(linked));
	});

	test("a live rule change that leaves a seated player or the self seat outside the table is rejected before writing", async ({
		api,
	}) => {
		const { rule, ringA, ringB } = await cashSetup(api);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [
				{ assetId: jpy.id, effect: "real", quantity: 100, role: "buy_in" },
			],
			ringGameId: ringA.id,
			startedAt: Math.floor(Date.now() / 1000) - HOUR,
		});
		const id = started.id;
		const villain = requireCreatedRow(
			await api.alice.player.create({ name: "Villain" })
		);
		const self = await api.alice.player.getSelf();
		await api.alice.tablePlayer.add({
			entryId: id,
			playerId: villain.id,
			seatPosition: 2,
		});
		await api.alice.tablePlayer.add({
			entryId: id,
			playerId: self.id,
			seatPosition: 7,
		});
		const sixHanded = await api.alice.entry.create({
			kind: "cash",
			playedOn: "2026-09-01",
			rule: { ...rule, tableSize: 6 },
		});
		const before = await cashVersions(api);

		const rejected = [
			() =>
				api.alice.live.overrideRule({
					id,
					kind: "cash",
					rule: { tableSize: 6 },
				}),
			() =>
				api.alice.entry.overrideRule({
					id,
					kind: "cash",
					rule: { tableSize: 6 },
				}),
			() =>
				api.alice.live.relink({ id, keepRule: false, ringGameId: ringB.id }),
			() =>
				api.alice.live.restoreRule({
					id,
					masterId: null,
					ruleVersionId: sixHanded.ruleVersionId,
				}),
		];
		for (const call of rejected) {
			expect(await failure(call())).toMatchObject({ code: "BAD_REQUEST" });
		}
		await api.alice.ringGame.update({ id: ringA.id, rule: { tableSize: 6 } });
		expect(await failure(api.alice.live.applyMasterRule({ id }))).toMatchObject(
			{ code: "BAD_REQUEST" }
		);
		expect(
			(await cashVersions(api)).filter((row) =>
				before.some((old) => old.id === row.id)
			)
		).toEqual(before);
		expect(ruleState(await api.alice.live.getById({ id }))).toMatchObject({
			ringGameId: ringA.id,
			ruleVersionId: started.ruleVersionId,
		});

		await api.alice.tablePlayer.updateSeat({
			entryId: id,
			playerId: self.id,
			seatPosition: 5,
		});
		const applied = await api.alice.live.applyMasterRule({ id });
		expect(applied).toMatchObject({
			progress: null,
			ruleDrift: false,
			ruleVersion: { tableSize: 6 },
		});
	});

	test("createAndAssign links a live entry to a new master in one write, and restoreRule plus deleting the master undoes it", async ({
		api,
	}) => {
		const { rule, room } = await cashSetup(api);
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const started = await api.alice.live.create({
			kind: "cash",
			payments: [
				{ assetId: jpy.id, effect: "real", quantity: 100, role: "buy_in" },
			],
			rule,
			startedAt: Math.floor(Date.now() / 1000) - HOUR,
		});
		const assigned = await api.alice.live.createAndAssignRingGame({
			entryId: started.id,
			name: "New table",
			roomId: room.id,
			rule: { ...rule, minBuyIn: 500 },
		});
		expect(assigned.ringGameId).not.toBeNull();
		expect(assigned).toMatchObject({
			ruleDrift: false,
			ruleVersion: { minBuyIn: 500, ringGameId: assigned.ringGameId },
			ruleVersionId: assigned.currentMasterRuleId,
		});
		expect(
			await failure(
				api.alice.live.createAndAssignTournament({
					entryId: started.id,
					name: "Wrong kind",
					roomId: room.id,
					rule: { levels: [] },
				})
			)
		).toMatchObject({ code: "BAD_REQUEST" });

		const undone = await api.alice.live.restoreRule({
			id: started.id,
			masterId: null,
			ruleVersionId: started.ruleVersionId,
		});
		await api.alice.ringGame.delete({ id: assigned.ringGameId ?? "" });
		expect(ruleState(undone)).toEqual(ruleState(started));
		expect(
			(await api.alice.ringGame.listByRoom({ roomId: room.id })).map(
				(row) => row.name
			)
		).toEqual(["A", "B"]);
	});

	test("createAndAssignTournament and every rule operation at the tournament rule maxima stay inside the D1 query budget", async ({
		api,
	}) => {
		const jpy = requireCreatedRow(
			await api.alice.asset.create({ kind: "currency", name: "JPY" })
		);
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Hall" })
		);
		const { groupCount, levels } = await seedMaxRuleLevels(api);
		const prices = Array.from({ length: MAX_RULE_PRICES }, (_, index) => ({
			amount: index,
			assetId: jpy.id,
			chips: 1000,
			fee: 0,
			kind: "addon" as const,
		}));
		const other = await api.alice.tournament.create({
			name: "Other",
			roomId: room.id,
			rule: {},
		});
		const started = await api.alice.live.create({
			kind: "tournament",
			payments: [
				{ assetId: jpy.id, effect: "real", quantity: 100, role: "buy_in" },
			],
			startedAt: Math.floor(Date.now() / 1000) - HOUR,
		});
		const id = started.id;
		const tagIds: string[] = [];
		for (let index = 0; index < MAX_LINKED_TAGS; index += 1) {
			tagIds.push(
				requireCreatedRow(
					await api.alice.tournamentTag.create({ name: `Tag ${index}` })
				).id
			);
		}
		const measured: Record<string, number> = {};
		async function metered<Output>(
			name: string,
			run: (caller: ApiFixture["alice"]) => Promise<Output>
		): Promise<Output> {
			const { caller, meter } = api.meteredCaller("alice");
			const output = await run(caller);
			measured[name] = meter.statements;
			return output;
		}

		const assigned = await metered("createAndAssignTournament", (caller) =>
			caller.live.createAndAssignTournament({
				entryId: id,
				name: "Max",
				roomId: room.id,
				rule: { levels, prices, startingStack: 30_000 },
				tagIds,
			})
		);
		expect(assigned.ruleVersion).toMatchObject({
			levels: { length: MAX_RULE_LEVELS },
			prices: { length: MAX_RULE_PRICES },
		});
		expect(withoutIds(assigned).levels[0]?.stakes).toHaveLength(groupCount);
		const masterId = assigned.tournamentId ?? "";

		const overridden = await metered("overrideRule", (caller) =>
			caller.live.overrideRule({
				id,
				kind: "tournament",
				rule: {
					levels: levels.map((level) => ({
						...level,
						stakes: level.stakes.map((stake) => ({
							...stake,
							blind2: stake.blind2 + 1,
						})),
					})),
					prices: prices.map((price) => ({ ...price, fee: 1 })),
				},
			})
		);
		expect(overridden.ruleDrift).toBe(true);
		await metered("pushRuleToMaster", (caller) =>
			caller.live.pushRuleToMaster({ id })
		);
		await metered("relink", (caller) =>
			caller.live.relink({ id, keepRule: true, tournamentId: other.id })
		);
		await metered("relinkAdopt", (caller) =>
			caller.live.relink({ id, keepRule: false, tournamentId: masterId })
		);
		await metered("restoreRule", (caller) =>
			caller.live.restoreRule({
				id,
				masterId,
				masterRuleVersionId: assigned.ruleVersionId,
				ruleVersionId: assigned.ruleVersionId,
			})
		);
		await metered("applyMasterRule", (caller) =>
			caller.live.applyMasterRule({ id })
		);

		for (const [name, statements] of Object.entries(measured)) {
			expect(statements, name).toBeLessThanOrEqual(BUDGET);
		}
	});
});
