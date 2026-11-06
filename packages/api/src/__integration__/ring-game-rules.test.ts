import { user } from "@sapphire2/db/schema/auth";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { cashRule } from "@sapphire2/db/schema/rule";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
	hydrateCashRules,
	planCashRuleCopy,
	prepareCashRule,
} from "../services/cash-rules";
import { LineupPlanner, MAX_LINEUP_GROUPS } from "../services/game-lineup";
import {
	AUTH_QUERY_RESERVE,
	D1_QUERIES_PER_INVOCATION,
	requireCreatedRow,
	test,
} from "./test-fixture";

describe("ring game rule versions on D1", () => {
	test("rejects a rule edit planned before another edit commits", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				stakes: [
					{ blind1: 1, blind2: 2, gameGroupId: "alice:builtin-group:bigbet" },
				],
			},
		});
		const raced = api.raceCaller("alice", async () => {
			await api.alice.ringGame.update({
				id: created.id,
				rule: { minBuyIn: 100 },
			});
		});
		await expect(
			raced.ringGame.update({ id: created.id, rule: { minBuyIn: 200 } })
		).rejects.toMatchObject({ code: "CONFLICT" });
		const [saved] = await api.alice.ringGame.listByRoom({ roomId: room.id });
		expect(saved?.ruleVersion.minBuyIn).toBe(100);
		expect((await api.db.select().from(cashRule)).length).toBe(2);
	});

	test("rejects reusing a version under a different master", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const rule = {
			stakes: [
				{ blind1: 1, blind2: 2, gameGroupId: "alice:builtin-group:bigbet" },
			],
		};
		const first = await api.alice.ringGame.create({
			name: "First",
			roomId: room.id,
			rule,
		});
		const second = await api.alice.ringGame.create({
			name: "Second",
			roomId: room.id,
			rule,
		});
		const { rules } = await hydrateCashRules(api.db, "alice", [
			first.currentRuleId,
		]);
		const parent = rules.get(first.currentRuleId);
		if (!parent) {
			throw new Error("Missing rule");
		}
		await expect(
			prepareCashRule(api.db, "alice", second.id, {}, first.currentRuleId)
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		await expect(
			planCashRuleCopy(api.db, "alice", parent, { parent, ringGameId: null })
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
	});

	test("does not create a ring game in an archived room", async ({ api }) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.alice.room.archive({ id: room.id });
		await expect(
			api.alice.ringGame.create({
				name: "Cash",
				roomId: room.id,
				rule: {
					stakes: [
						{
							blind1: 1,
							blind2: 2,
							gameGroupId: "alice:builtin-group:bigbet",
						},
					],
				},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await api.alice.ringGame.listByRoom({ roomId: room.id })).toEqual(
			[]
		);
	});

	test("an omitted game on a fresh account seeds the masters and uses builtin NLH", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				stakes: [
					{
						blind1: 1,
						blind2: 2,
						gameGroupId: "alice:builtin-group:bigbet",
					},
				],
			},
		});
		expect(created.lineups[created.ruleVersion.lineupId]).toMatchObject({
			displayName: "NL Hold'em",
			gameMixId: null,
		});
	});

	test("reuses an explicitly selected lineup for the same variant in one plan", async ({
		api,
	}) => {
		const variant = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!variant) {
			throw new Error("Missing builtin NLH");
		}
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const game = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				game: { variantId: variant.id },
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: variant.groupId }],
			},
		});
		const lineupId = game.ruleVersion.lineupId;
		const planner = new LineupPlanner(api.db, "alice");
		await planner.prepare([{ lineupId }, { variantId: variant.id }]);
		expect(planner.resolve({ variantId: variant.id }).id).toBe(lineupId);
		expect(planner.resolve({ lineupId }).id).toBe(lineupId);
		expect(planner.statements()).toHaveLength(0);
	});

	test("rejects new selections containing archived composition members", async ({
		api,
	}) => {
		const variants = await api.alice.gameVariant.list();
		const variant = variants.find((row) => row.builtinKey === "nlh");
		const second = variants.find((row) => row.builtinKey === "plo");
		if (!(variant && second)) {
			throw new Error("Missing builtin variants");
		}
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				games: [variant.id, second.id],
				label: "Test mix",
			})
		);
		await api.d1
			.prepare("UPDATE game_variant SET archived_at = 1 WHERE id = ?")
			.bind(variant.id)
			.run();
		await expect(
			new LineupPlanner(api.db, "alice").prepare([{ gameMixId: mix.id }])
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await api.d1
			.prepare("UPDATE game_variant SET archived_at = NULL WHERE id = ?")
			.bind(variant.id)
			.run();
		await api.d1
			.prepare("UPDATE game_group SET archived_at = 1 WHERE id = ?")
			.bind(variant.groupId)
			.run();
		await expect(
			new LineupPlanner(api.db, "alice").prepare([{ variantId: variant.id }])
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			new LineupPlanner(api.db, "alice").prepare([{ gameMixId: mix.id }])
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("persists a mix at the lineup group limit within D1's statement budget and rejects one more group", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.alice.gameGroup.list();
		const games: string[] = [];
		const stakes: { gameGroupId: string; blind1: number }[] = [];
		const groups: string[] = [];
		const first = requireCreatedRow(
			await api.alice.gameGroup.create({
				blind1Label: "Blind",
				label: "Group 0",
			})
		);
		groups.push(first.id);
		for (let index = 0; index <= MAX_LINEUP_GROUPS; index++) {
			if (index > 0) {
				const group = requireCreatedRow(
					await api.alice.gameGroup.create({
						blind1Label: "Blind",
						label: `Group ${index}`,
					})
				);
				groups.push(group.id);
			}
			const variant = requireCreatedRow(
				await api.alice.gameVariant.create({
					groupId: first.id,
					label: `Variant ${index}`,
				})
			);
			games.push(variant.id);
			if (index < MAX_LINEUP_GROUPS) {
				stakes.push({ blind1: index, gameGroupId: groups[index] as string });
			}
		}
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				games: games.slice(0, MAX_LINEUP_GROUPS),
				label: "Wide",
			})
		);
		const wider = requireCreatedRow(
			await api.alice.gameMix.create({ games, label: "Wider" })
		);
		for (let index = 1; index < MAX_LINEUP_GROUPS; index++) {
			await api.alice.gameVariant.update({
				groupId: groups[index] as string,
				id: games[index] as string,
			});
		}
		await api.alice.gameMix.archive({ id: wider.id });
		await expect(
			api.alice.gameVariant.update({
				groupId: groups[MAX_LINEUP_GROUPS] as string,
				id: games[MAX_LINEUP_GROUPS] as string,
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: expect.stringContaining("Wider"),
		});
		expect(
			(await api.alice.gameVariant.list()).find(
				(variant) => variant.id === games[MAX_LINEUP_GROUPS]
			)?.groupId
		).toBe(first.id);
		await api.alice.gameMix.restore({ id: wider.id });
		await api.db
			.update(gameVariant)
			.set({ groupId: groups[MAX_LINEUP_GROUPS] as string })
			.where(eq(gameVariant.id, games[MAX_LINEUP_GROUPS] as string));
		const { caller, meter } = api.meteredCaller("alice");
		const game = await caller.ringGame.create({
			name: "Wide",
			roomId: room.id,
			rule: { game: { gameMixId: mix.id }, stakes },
		});
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
		meter.statements = 0;
		await caller.ringGame.update({
			id: game.id,
			rule: { minBuyIn: 50, stakes },
		});
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
		expect(game.ruleVersion.stakes).toHaveLength(MAX_LINEUP_GROUPS);
		expect(game.lineups[game.ruleVersion.lineupId]?.groups).toHaveLength(
			MAX_LINEUP_GROUPS
		);
		expect(game.ruleVersion.stakes.map((stake) => stake.blind1)).toEqual(
			stakes.map((stake) => stake.blind1)
		);
		const before = await api.db.select().from(cashRule);
		await expect(
			api.alice.ringGame.create({
				name: "Wider",
				roomId: room.id,
				rule: { game: { gameMixId: wider.id } },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await api.db.select().from(cashRule)).toEqual(before);
	});

	test("reuses identical versions, preserves history and restores without inserting a version", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const variant = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!variant) {
			throw new Error("Missing seeded variant");
		}
		const original = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				game: { variantId: variant.id },
				maxBuyIn: 200,
				minBuyIn: 100,
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: variant.groupId }],
			},
		});
		const repeated = await api.alice.ringGame.update({
			id: original.id,
			rule: { maxBuyIn: 200, minBuyIn: 100 },
		});
		expect(repeated.currentRuleId).toBe(original.currentRuleId);
		const changed = await api.alice.ringGame.update({
			id: original.id,
			rule: { minBuyIn: 150 },
		});
		expect(changed.currentRuleId).not.toBe(original.currentRuleId);
		const before = await api.db.select().from(cashRule);
		expect(
			before.find((row) => row.id === original.currentRuleId)
		).toMatchObject({ maxBuyIn: 200, minBuyIn: 100 });
		const restored = await api.alice.ringGame.restoreRule({
			id: original.id,
			ruleVersionId: original.currentRuleId,
		});
		expect(restored.currentRuleId).toBe(original.currentRuleId);
		expect(restored.ruleVersion).toEqual(original.ruleVersion);
		expect(restored.lineups).toEqual(original.lineups);
		expect(await api.db.select().from(cashRule)).toEqual(before);
		const listed = await api.alice.ringGame.listByRoom({ roomId: room.id });
		expect(listed).toContainEqual(
			expect.objectContaining({
				currentRuleId: original.currentRuleId,
				id: original.id,
				lineups: original.lineups,
				ruleVersion: original.ruleVersion,
			})
		);
	});

	test("id selections disambiguate a variant named mix from a mix with the same label and preserve archived lineups", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const variants = await api.alice.gameVariant.list();
		const first = variants.find((row) => row.builtinKey === "nlh");
		const second = variants.find(
			(row) => first && row.groupId === first.groupId && row.id !== first.id
		);
		if (!(first && second)) {
			throw new Error("Missing seeded variants");
		}
		const variant = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: first.groupId,
				label: "mix",
			})
		);
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				games: [first.id, second.id],
				label: "mix",
			})
		);
		const single = await api.alice.ringGame.create({
			name: "Single",
			roomId: room.id,
			rule: {
				game: { variantId: variant.id },
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: first.groupId }],
			},
		});
		const mixed = await api.alice.ringGame.create({
			name: "Mixed",
			roomId: room.id,
			rule: {
				game: { gameMixId: mix.id },
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: first.groupId }],
			},
		});
		expect(single.lineups[single.ruleVersion.lineupId]?.gameMixId).toBeNull();
		expect(mixed.lineups[mixed.ruleVersion.lineupId]?.gameMixId).toBe(mix.id);
		await api.alice.gameVariant.archive({ id: variant.id });
		const saved = await api.alice.ringGame.update({
			id: single.id,
			rule: { game: { lineupId: single.ruleVersion.lineupId } },
		});
		expect(saved.currentRuleId).toBe(single.currentRuleId);
		await expect(
			api.alice.ringGame.create({
				name: "New",
				roomId: room.id,
				rule: {
					game: { variantId: variant.id },
					stakes: [{ blind1: 1, blind2: 2, gameGroupId: first.groupId }],
				},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("rejects foreign versions, assets and stakes outside the lineup without partial writes", async ({
		api,
	}) => {
		const aliceNlh = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		const bobNlh = (await api.bob.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!(aliceNlh && bobNlh)) {
			throw new Error("Missing builtin NLH");
		}
		const aliceRoom = requireCreatedRow(
			await api.alice.room.create({ name: "Alice" })
		);
		const bobRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Bob" })
		);
		const alice = await api.alice.ringGame.create({
			name: "A",
			roomId: aliceRoom.id,
			rule: {
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: aliceNlh.groupId }],
			},
		});
		const other = await api.alice.ringGame.create({
			name: "Other",
			roomId: aliceRoom.id,
			rule: {
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: aliceNlh.groupId }],
			},
		});
		const bob = await api.bob.ringGame.create({
			name: "B",
			roomId: bobRoom.id,
			rule: { stakes: [{ blind1: 1, blind2: 2, gameGroupId: bobNlh.groupId }] },
		});
		const asset = requireCreatedRow(
			await api.bob.asset.create({ kind: "currency", name: "Bob chips" })
		);
		const before = await api.db.select().from(cashRule);
		await expect(
			api.alice.ringGame.restoreRule({
				id: alice.id,
				ruleVersionId: other.currentRuleId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.ringGame.update({ defaultAssetId: asset.id, id: alice.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.ringGame.update({
				id: alice.id,
				rule: { stakes: [{ blind1: 1, gameGroupId: bobNlh.groupId }] },
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const groups = await api.alice.gameGroup.list();
		const lineupGroup =
			alice.lineups[alice.ruleVersion.lineupId]?.groups[0]?.gameGroupId;
		const wrong = groups.find((group) => group.id !== lineupGroup);
		if (!wrong) {
			throw new Error("Missing unrelated seeded group");
		}
		await expect(
			api.alice.ringGame.update({
				id: alice.id,
				rule: { stakes: [{ blind1: 10, gameGroupId: wrong.id }] },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.d1
				.prepare("UPDATE ring_game SET current_rule_id = ? WHERE id = ?")
				.bind(bob.currentRuleId, alice.id)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		await expect(
			api.d1
				.prepare("UPDATE ring_game SET default_asset_id = ? WHERE id = ?")
				.bind(asset.id, alice.id)
				.run()
		).rejects.toThrow("FOREIGN KEY constraint failed");
		await api.d1
			.prepare("UPDATE ring_game SET current_rule_id = ? WHERE id = ?")
			.bind(other.currentRuleId, alice.id)
			.run();
		await expect(
			api.alice.ringGame.listByRoom({ roomId: aliceRoom.id })
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		await api.d1
			.prepare("UPDATE ring_game SET current_rule_id = ? WHERE id = ?")
			.bind(alice.currentRuleId, alice.id)
			.run();
		expect(await api.db.select().from(cashRule)).toEqual(before);
		await api.db.delete(user).where(eq(user.id, "alice"));
	});

	test("rejects reversed buy-in bounds on create and update", async ({
		api,
	}) => {
		const nlh = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!nlh) {
			throw new Error("Missing builtin NLH");
		}
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await expect(
			api.alice.ringGame.create({
				name: "Invalid",
				roomId: room.id,
				rule: {
					maxBuyIn: 100,
					minBuyIn: 200,
					stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
				},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const game = await api.alice.ringGame.create({
			name: "Valid",
			roomId: room.id,
			rule: {
				maxBuyIn: 200,
				minBuyIn: 100,
				stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
			},
		});
		await expect(
			api.alice.ringGame.update({ id: game.id, rule: { minBuyIn: 201 } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
