import { entry, entryTournament } from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import {
	tournamentRule,
	tournamentRuleLevel,
	tournamentRuleLevelStake,
	tournamentRulePrice,
} from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { MAX_LINKED_TAGS } from "@sapphire2/db/schemas/tag-ids";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { MAX_RULE_LEVELS, MAX_RULE_PRICES } from "../services/tournament-rule";
import {
	type ApiFixture,
	AUTH_QUERY_RESERVE,
	D1_QUERIES_PER_INVOCATION,
	requireCreatedRow,
	seedMaxRuleLevels,
	test,
} from "./test-fixture";

const FOREIGN_KEY_FAILURE = /FOREIGN KEY/;
const ARCHIVE_GUIDANCE = /archive/i;
const day = new Date("2026-09-05T00:00:00.000Z");

async function setup(api: ApiFixture) {
	const variants = await api.alice.gameVariant.list();
	const variant = (key: string) => {
		const found = variants.find((row) => row.builtinKey === key);
		if (!found) {
			throw new Error(`missing builtin variant ${key}`);
		}
		return found;
	};
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const cash = requireCreatedRow(
		await api.alice.asset.create({ name: "JPY", kind: "currency" })
	);
	const ticket = requireCreatedRow(
		await api.alice.asset.create({ name: "Satellite ticket", kind: "item" })
	);
	return {
		room,
		cash,
		ticket,
		nlh: variant("nlh"),
		plo: variant("plo"),
		razz: variant("razz"),
	};
}

function withoutIds<T>(value: T): unknown {
	return JSON.parse(
		JSON.stringify(value, (key, field) =>
			key === "id" || key === "lineupGroupId" ? undefined : field
		)
	);
}

async function versionCount(api: ApiFixture): Promise<number> {
	return (await api.db.select({ id: tournamentRule.id }).from(tournamentRule))
		.length;
}

describe("tournament rule versions on D1", () => {
	test("does not create a tournament in an archived room", async ({ api }) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.alice.room.archive({ id: room.id });
		await expect(
			api.alice.tournament.create({ roomId: room.id, name: "Daily", rule: {} })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await api.alice.tournament.listByRoom({ roomId: room.id })).toEqual(
			[]
		);
	});

	test("saves whole versions, reuses an unchanged one, and restoreRule repoints without a new version", async ({
		api,
	}) => {
		const { room, cash, ticket, nlh, razz } = await setup(api);
		const created = await api.alice.tournament.createWithLevels({
			roomId: room.id,
			name: "Sunday",
			defaultAssetId: cash.id,
			rule: {
				game: { variantId: nlh.id },
				startingStack: 20_000,
				tableSize: 9,
				levels: [
					{
						isBreak: false,
						minutes: 20,
						stakes: [
							{
								gameGroupId: nlh.groupId,
								blind1: 100,
								blind2: 200,
								ante: 200,
								anteType: "bb",
							},
						],
					},
					{ isBreak: true, minutes: 10 },
					{
						isBreak: false,
						minutes: 20,
						game: { variantId: razz.id },
						stakes: [
							{ gameGroupId: razz.groupId, blind1: 50, blind2: 100, ante: 10 },
						],
					},
				],
				prices: [
					{
						kind: "entry",
						assetId: cash.id,
						amount: 10_000,
						fee: 1000,
						chips: null,
					},
					{
						kind: "addon",
						assetId: ticket.id,
						amount: 1,
						fee: 0,
						chips: 10_000,
						label: "Ticket add-on",
					},
				],
			},
		});
		const v1 = created.ruleVersion;
		expect(v1.levels.map((level) => [level.ordinal, level.level])).toEqual([
			[1, 1],
			[2, null],
			[3, 2],
		]);
		expect(v1.levels[0]?.game).toBeNull();
		expect(v1.levels[0]?.stakes).toEqual([
			expect.objectContaining({
				gameGroupId: nlh.groupId,
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 200,
				anteType: "bb",
			}),
		]);
		expect(v1.levels[1]?.stakes).toEqual([]);
		const razzLineupId = v1.levels[2]?.game?.lineupId ?? "";
		expect(created.lineups[razzLineupId]?.displayName).toBe("Razz");
		expect(created.lineups[v1.lineupId]?.displayName).toBe("NL Hold'em");
		expect(withoutIds(v1.prices)).toEqual([
			{
				ordinal: 1,
				kind: "entry",
				assetId: cash.id,
				amount: 10_000,
				fee: 1000,
				chips: null,
				label: "",
			},
			{
				ordinal: 2,
				kind: "addon",
				assetId: ticket.id,
				amount: 1,
				fee: 0,
				chips: 10_000,
				label: "Ticket add-on",
			},
		]);

		const updated = await api.alice.tournament.update({
			id: created.id,
			rule: { startingStack: 30_000 },
		});
		expect(updated.currentRuleId).not.toBe(v1.id);
		expect(updated.ruleVersion.parentRuleId).toBe(v1.id);
		expect(updated.ruleVersion.startingStack).toBe(30_000);
		expect(withoutIds(updated.ruleVersion.levels)).toEqual(
			withoutIds(v1.levels)
		);
		expect(withoutIds(updated.ruleVersion.prices)).toEqual(
			withoutIds(v1.prices)
		);
		expect(await versionCount(api)).toBe(2);

		const resaved = await api.alice.tournament.update({
			id: created.id,
			rule: { startingStack: 30_000, game: { variantId: nlh.id } },
		});
		expect(resaved.currentRuleId).toBe(updated.currentRuleId);
		expect(await versionCount(api)).toBe(2);

		const restored = await api.alice.tournament.restoreRule({
			id: created.id,
			ruleVersionId: v1.id,
		});
		expect(restored.currentRuleId).toBe(v1.id);
		expect(restored.ruleVersion).toEqual(v1);
		expect(await versionCount(api)).toBe(2);
	});

	test("a metadata update preserves independently changed fields and rule selection", async ({
		api,
	}) => {
		const { room } = await setup(api);
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Original",
			rule: {},
		});
		await api.alice.tournament.update({
			id: created.id,
			rule: { startingStack: 5000 },
		});
		await api.d1
			.prepare(
				"CREATE TRIGGER concurrent_tournament_change BEFORE UPDATE OF updated_at ON tournament BEGIN UPDATE tournament SET name = 'Changed', current_rule_id = (SELECT parent_rule_id FROM tournament_rule WHERE id = OLD.current_rule_id) WHERE id = OLD.id; END"
			)
			.run();
		const updated = await api.alice.tournament.update({
			id: created.id,
			memo: "Note",
		});
		expect(updated.name).toBe("Changed");
		expect(updated.currentRuleId).toBe(created.currentRuleId);
		expect(updated.memo).toBe("Note");
	});

	test("changing the default game moves inheriting levels and carries stakes by game group and occurrence", async ({
		api,
	}) => {
		const { room, nlh, plo, razz } = await setup(api);
		const forward = requireCreatedRow(
			await api.alice.gameMix.create({
				label: "NLH Razz",
				games: [nlh.id, razz.id],
			})
		);
		const reversed = requireCreatedRow(
			await api.alice.gameMix.create({
				label: "Razz NLH",
				games: [razz.id, nlh.id],
			})
		);
		const created = await api.alice.tournament.createWithLevels({
			roomId: room.id,
			name: "Mixed",
			rule: {
				game: { gameMixId: forward.id },
				levels: [
					{
						isBreak: false,
						stakes: [
							{ gameGroupId: nlh.groupId, blind1: 100, blind2: 200 },
							{ gameGroupId: razz.groupId, blind1: 10, blind2: 20 },
						],
					},
					{
						isBreak: false,
						game: { variantId: plo.id },
						stakes: [{ gameGroupId: plo.groupId, blind1: 300, blind2: 600 }],
					},
				],
			},
		});
		const overrideLevel = created.ruleVersion.levels[1];

		const reordered = await api.alice.tournament.update({
			id: created.id,
			rule: { game: { gameMixId: reversed.id } },
		});
		const [inherited, override] = reordered.ruleVersion.levels;
		expect(inherited?.game).toBeNull();
		expect(inherited?.effectiveLineupId).toBe(reordered.ruleVersion.lineupId);
		expect(
			inherited?.stakes.map((stake) => [
				stake.gameGroupId,
				stake.blind1,
				stake.blind2,
			])
		).toEqual([
			[razz.groupId, 10, 20],
			[nlh.groupId, 100, 200],
		]);
		expect(override).toMatchObject({
			game: overrideLevel?.game,
			stakes: overrideLevel?.stakes,
		});
		expect(reordered.lineups[reordered.ruleVersion.lineupId]).toMatchObject({
			gameMixId: reversed.id,
			displayName: "Razz NLH",
		});

		const stud = await api.alice.tournament.update({
			id: created.id,
			rule: { game: { variantId: razz.id } },
		});
		expect(stud.ruleVersion.levels[0]?.stakes).toEqual([
			expect.objectContaining({
				gameGroupId: razz.groupId,
				blind1: 10,
				blind2: 20,
			}),
		]);
	});

	test("rejects invalid stakes, games on breaks and foreign or misplaced references without moving the pointer", async ({
		api,
	}) => {
		const { room, cash, nlh, razz } = await setup(api);
		const bobAsset = requireCreatedRow(
			await api.bob.asset.create({ name: "USD", kind: "currency" })
		);
		const bobVariants = await api.bob.gameVariant.list();
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Daily",
			rule: {},
		});
		const other = await api.alice.tournament.create({
			roomId: room.id,
			name: "Other",
			rule: {},
		});
		const attempts: [() => Promise<unknown>, string][] = [
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						rule: {
							levels: [
								{
									isBreak: false,
									stakes: [{ gameGroupId: razz.groupId, blind1: 1, blind2: 2 }],
								},
							],
						},
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						rule: {
							levels: [
								{
									isBreak: false,
									stakes: [
										{ gameGroupId: bobVariants[0]?.groupId ?? "missing" },
									],
								},
							],
						},
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						rule: {
							levels: [{ isBreak: true, game: { variantId: nlh.id } }],
						},
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						rule: {
							prices: [
								{
									kind: "entry",
									assetId: bobAsset.id,
									amount: 1,
									fee: 0,
									chips: null,
								},
							],
						},
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						rule: { game: { variantId: bobVariants[0]?.id ?? "" } },
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.alice.tournament.update({
						id: created.id,
						defaultAssetId: bobAsset.id,
					}),
				"FORBIDDEN",
			],
			[
				() =>
					api.alice.tournament.restoreRule({
						id: created.id,
						ruleVersionId: other.currentRuleId,
					}),
				"BAD_REQUEST",
			],
			[
				() =>
					api.bob.tournament.restoreRule({
						id: created.id,
						ruleVersionId: created.currentRuleId,
					}),
				"FORBIDDEN",
			],
		];
		for (const [attempt, code] of attempts) {
			await expect(attempt()).rejects.toMatchObject({ code });
		}
		const after = await api.alice.tournament.getById({ id: created.id });
		expect(after.currentRuleId).toBe(created.currentRuleId);
		expect(await versionCount(api)).toBe(2);

		const bobRule = await api.bob.tournament.create({
			roomId: requireCreatedRow(await api.bob.room.create({ name: "Bob club" }))
				.id,
			name: "Bob",
			rule: {},
		});
		await expect(
			api.d1
				.prepare("UPDATE tournament SET current_rule_id = ? WHERE id = ?")
				.bind(bobRule.currentRuleId, created.id)
				.run()
		).rejects.toThrow(FOREIGN_KEY_FAILURE);
		await expect(
			api.d1
				.prepare("UPDATE tournament SET default_asset_id = ? WHERE id = ?")
				.bind(bobAsset.id, created.id)
				.run()
		).rejects.toThrow(FOREIGN_KEY_FAILURE);
		const withStake = await api.alice.tournament.update({
			id: created.id,
			defaultAssetId: cash.id,
			rule: {
				levels: [
					{
						isBreak: false,
						stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
					},
				],
			},
		});
		const foreignLineup = other.ruleVersion.lineupId;
		const [foreignGroup] = other.lineups[foreignLineup]?.groups ?? [];
		await expect(
			api.d1
				.prepare(
					"UPDATE tournament_rule_level_stake SET lineup_group_id = ? WHERE level_id = ?"
				)
				.bind(foreignGroup?.id ?? "", withStake.ruleVersion.levels[0]?.id ?? "")
				.run()
		).rejects.toThrow(FOREIGN_KEY_FAILURE);
	});

	test("saves more than twelve levels atomically and a failed write keeps the previous version current", async ({
		api,
	}) => {
		const { room, cash, nlh } = await setup(api);
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Deep",
			rule: { game: { variantId: nlh.id } },
		});
		const levels = Array.from({ length: 30 }, (_, index) => ({
			isBreak: index % 5 === 4,
			minutes: 20,
			...(index % 5 === 4
				? {}
				: {
						stakes: [
							{
								gameGroupId: nlh.groupId,
								blind1: (index + 1) * 100,
								blind2: (index + 1) * 200,
							},
						],
					}),
		}));
		const prices = Array.from({ length: 12 }, (_, index) => ({
			kind: "reentry" as const,
			assetId: cash.id,
			amount: index * 100,
			fee: 0,
			chips: 10_000,
		}));
		await api.d1
			.prepare(
				"CREATE TRIGGER fail_price BEFORE INSERT ON tournament_rule_price WHEN NEW.amount = 1100 BEGIN SELECT RAISE(ABORT, 'forced failure'); END"
			)
			.run();
		await expect(
			api.alice.tournament.updateWithLevels({
				id: created.id,
				rule: { levels, prices },
			})
		).rejects.toThrow();
		const [master] = await api.db
			.select()
			.from(tournament)
			.where(eq(tournament.id, created.id));
		expect(master?.currentRuleId).toBe(created.currentRuleId);
		expect(await versionCount(api)).toBe(1);
		expect(await api.db.select().from(tournamentRuleLevel)).toEqual([]);

		await api.d1.prepare("DROP TRIGGER fail_price").run();
		const saved = await api.alice.tournament.updateWithLevels({
			id: created.id,
			rule: { levels, prices },
		});
		expect(saved.ruleVersion.levels).toHaveLength(30);
		expect(saved.ruleVersion.levels[28]?.stakes[0]).toMatchObject({
			blind1: 2900,
			blind2: 5800,
		});
		expect(saved.ruleVersion.prices.map((price) => price.amount)).toEqual(
			prices.map((price) => price.amount)
		);
		expect((await api.db.select().from(tournamentRuleLevelStake)).length).toBe(
			24
		);
	});

	test("deletes an unused tournament with its versions but conflicts on any entry, version or price reference", async ({
		api,
	}) => {
		const { room, cash } = await setup(api);
		const make = async (name: string) =>
			await api.alice.tournament.create({
				roomId: room.id,
				name,
				rule: {
					prices: [
						{
							kind: "entry",
							assetId: cash.id,
							amount: 100,
							fee: 0,
							chips: null,
						},
					],
				},
			});
		const byRule = await make("Pinned version");
		const byPrice = await make("Charged price");
		await api.alice.tournament.update({
			id: byRule.id,
			rule: { startingStack: 1 },
		});
		await api.db.insert(entry).values(
			["pinned", "charged"].map((id) => ({
				id,
				userId: "alice",
				kind: "tournament" as const,
				source: "manual" as const,
				status: "settled" as const,
				playedOn: "2026-09-05",
				updatedAt: day,
			}))
		);
		await api.db.insert(entryTournament).values({
			entryId: "pinned",
			userId: "alice",
			tournamentRuleId: byRule.currentRuleId,
		});
		await api.db.insert(ledgerLine).values({
			id: "line",
			userId: "alice",
			assetId: cash.id,
			quantity: -100,
			role: "buy_in",
			effect: "real",
			entryId: "charged",
			priceId: byPrice.ruleVersion.prices[0]?.id,
			occurredAt: day,
			updatedAt: day,
		});
		for (const id of [byRule.id, byPrice.id]) {
			await expect(api.alice.tournament.delete({ id })).rejects.toMatchObject({
				code: "CONFLICT",
				message: expect.stringMatching(ARCHIVE_GUIDANCE),
			});
		}
		await expect(
			api.bob.tournament.delete({ id: byRule.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(await versionCount(api)).toBe(3);
	});

	test("account deletion removes masters, versions and prices", async ({
		api,
	}) => {
		const { room, cash, nlh } = await setup(api);
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Daily",
			defaultAssetId: cash.id,
			rule: {
				levels: [
					{
						isBreak: false,
						stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
					},
				],
				prices: [
					{ kind: "entry", assetId: cash.id, amount: 100, fee: 0, chips: null },
				],
			},
		});
		await api.alice.tournament.update({
			id: created.id,
			rule: { startingStack: 5000 },
		});
		await api.d1.prepare("DELETE FROM user WHERE id = 'alice'").run();
		expect(await api.db.select().from(tournament)).toEqual([]);
		expect(await api.db.select().from(tournamentRule)).toEqual([]);
		expect(await api.db.select().from(tournamentRulePrice)).toEqual([]);
	});

	test("a save at the level, price, lineup and tag maxima stays inside the D1 query budget", async ({
		api,
	}) => {
		const { room, cash } = await setup(api);
		const { groupCount, levels } = await seedMaxRuleLevels(api);
		await api.d1
			.prepare(
				"WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?) INSERT INTO tournament_tag (id, user_id, name, sort_order, updated_at) SELECT 'tt-' || i, 'alice', 'Tag ' || i, i, 0 FROM n"
			)
			.bind(MAX_LINKED_TAGS)
			.run();
		const tagIds = Array.from(
			{ length: MAX_LINKED_TAGS },
			(_, index) => `tt-${index}`
		);
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Max",
			rule: {},
			tagIds: tagIds.slice(0, 1),
		});
		const { caller, meter } = api.meteredCaller("alice");
		const saved = await caller.tournament.updateWithLevels({
			id: created.id,
			tagIds,
			rule: {
				levels,
				prices: Array.from({ length: MAX_RULE_PRICES }, (_, index) => ({
					kind: "addon" as const,
					assetId: cash.id,
					amount: index,
					fee: 0,
					chips: 1000,
				})),
			},
		});
		expect(saved.ruleVersion.levels).toHaveLength(MAX_RULE_LEVELS);
		expect(saved.tags.map(({ id }) => id)).toEqual(tagIds);
		expect(
			new Set(saved.ruleVersion.levels.map((level) => level.effectiveLineupId))
				.size
		).toBe(MAX_RULE_LEVELS);
		expect(saved.ruleVersion.levels[0]?.stakes).toHaveLength(groupCount);
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
	});
});
