import { user } from "@sapphire2/db/schema/auth";
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
	test("rejects reusing a version under a different master", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const rule = {
			stakes: [
				{ gameGroupId: "alice:builtin-group:bigbet", blind1: 1, blind2: 2 },
			],
		};
		const first = await api.alice.ringGame.create({
			roomId: room.id,
			name: "First",
			rule,
		});
		const second = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Second",
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
				roomId: room.id,
				name: "Cash",
				rule: {
					stakes: [
						{
							gameGroupId: "alice:builtin-group:bigbet",
							blind1: 1,
							blind2: 2,
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
			roomId: room.id,
			name: "Cash",
			rule: {
				stakes: [
					{
						gameGroupId: "alice:builtin-group:bigbet",
						blind1: 1,
						blind2: 2,
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
			roomId: room.id,
			name: "Cash",
			rule: {
				game: { variantId: variant.id },
				stakes: [{ gameGroupId: variant.groupId, blind1: 1, blind2: 2 }],
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
				label: "Test mix",
				games: [variant.id, second.id],
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
				label: "Group 0",
				blind1Label: "Blind",
			})
		);
		groups.push(first.id);
		for (let index = 0; index <= MAX_LINEUP_GROUPS; index++) {
			if (index > 0) {
				const group = requireCreatedRow(
					await api.alice.gameGroup.create({
						label: `Group ${index}`,
						blind1Label: "Blind",
					})
				);
				groups.push(group.id);
			}
			const variant = requireCreatedRow(
				await api.alice.gameVariant.create({
					label: `Variant ${index}`,
					groupId: first.id,
				})
			);
			games.push(variant.id);
			if (index < MAX_LINEUP_GROUPS) {
				stakes.push({ gameGroupId: groups[index] as string, blind1: index });
			}
		}
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				label: "Wide",
				games: games.slice(0, MAX_LINEUP_GROUPS),
			})
		);
		const wider = requireCreatedRow(
			await api.alice.gameMix.create({ label: "Wider", games })
		);
		for (let index = 1; index <= MAX_LINEUP_GROUPS; index++) {
			await api.alice.gameVariant.update({
				id: games[index] as string,
				groupId: groups[index] as string,
			});
		}
		const { caller, meter } = api.meteredCaller("alice");
		const game = await caller.ringGame.create({
			roomId: room.id,
			name: "Wide",
			rule: { game: { gameMixId: mix.id }, stakes },
		});
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
		meter.statements = 0;
		await caller.ringGame.update({
			id: game.id,
			rule: { stakes, minBuyIn: 50 },
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
				roomId: room.id,
				name: "Wider",
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
			roomId: room.id,
			name: "Cash",
			rule: {
				game: { variantId: variant.id },
				stakes: [{ gameGroupId: variant.groupId, blind1: 1, blind2: 2 }],
				minBuyIn: 100,
				maxBuyIn: 200,
			},
		});
		const repeated = await api.alice.ringGame.update({
			id: original.id,
			rule: { minBuyIn: 100, maxBuyIn: 200 },
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
		).toMatchObject({ minBuyIn: 100, maxBuyIn: 200 });
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
				id: original.id,
				currentRuleId: original.currentRuleId,
				ruleVersion: original.ruleVersion,
				lineups: original.lineups,
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
				label: "mix",
				groupId: first.groupId,
			})
		);
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				label: "mix",
				games: [first.id, second.id],
			})
		);
		const single = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Single",
			rule: {
				game: { variantId: variant.id },
				stakes: [{ gameGroupId: first.groupId, blind1: 1, blind2: 2 }],
			},
		});
		const mixed = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Mixed",
			rule: {
				game: { gameMixId: mix.id },
				stakes: [{ gameGroupId: first.groupId, blind1: 1, blind2: 2 }],
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
				roomId: room.id,
				name: "New",
				rule: {
					game: { variantId: variant.id },
					stakes: [{ gameGroupId: first.groupId, blind1: 1, blind2: 2 }],
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
			roomId: aliceRoom.id,
			name: "A",
			rule: {
				stakes: [{ gameGroupId: aliceNlh.groupId, blind1: 1, blind2: 2 }],
			},
		});
		const other = await api.alice.ringGame.create({
			roomId: aliceRoom.id,
			name: "Other",
			rule: {
				stakes: [{ gameGroupId: aliceNlh.groupId, blind1: 1, blind2: 2 }],
			},
		});
		const bob = await api.bob.ringGame.create({
			roomId: bobRoom.id,
			name: "B",
			rule: { stakes: [{ gameGroupId: bobNlh.groupId, blind1: 1, blind2: 2 }] },
		});
		const asset = requireCreatedRow(
			await api.bob.asset.create({ name: "Bob chips", kind: "currency" })
		);
		const before = await api.db.select().from(cashRule);
		await expect(
			api.alice.ringGame.restoreRule({
				id: alice.id,
				ruleVersionId: other.currentRuleId,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			api.alice.ringGame.update({ id: alice.id, defaultAssetId: asset.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.ringGame.update({
				id: alice.id,
				rule: { stakes: [{ gameGroupId: bobNlh.groupId, blind1: 1 }] },
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
				rule: { stakes: [{ gameGroupId: wrong.id, blind1: 10 }] },
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
				roomId: room.id,
				name: "Invalid",
				rule: {
					stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
					minBuyIn: 200,
					maxBuyIn: 100,
				},
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const game = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Valid",
			rule: {
				stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
				minBuyIn: 100,
				maxBuyIn: 200,
			},
		});
		await expect(
			api.alice.ringGame.update({ id: game.id, rule: { minBuyIn: 201 } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
