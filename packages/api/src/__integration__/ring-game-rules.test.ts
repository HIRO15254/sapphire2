import { createDb } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { cashRule } from "@sapphire2/db/schema/rule";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("ring game rule versions on D1", () => {
	test("rejects an omitted game when builtin NLH is unavailable", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await expect(
			api.alice.ringGame.create({ roomId: room.id, name: "Cash", rule: {} })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("persists a 30-group mix and its complete stake set within D1's bind budget", async ({
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
		for (let index = 0; index < 30; index++) {
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
			stakes.push({ gameGroupId: groups[index] as string, blind1: index });
		}
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({ label: "Thirty", games })
		);
		for (let index = 1; index < 30; index++) {
			await api.alice.gameVariant.update({
				id: games[index] as string,
				groupId: groups[index] as string,
			});
		}
		let statements = 0;
		const counted = new Proxy(api.d1, {
			get(target, property) {
				if (property === "prepare") {
					return (query: string) => {
						statements++;
						return target.prepare(query);
					};
				}
				const value = Reflect.get(target, property, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const caller = api.caller(
			"alice",
			createDb(counted as unknown as Parameters<typeof createDb>[0])
		);
		const game = await caller.ringGame.create({
			roomId: room.id,
			name: "Thirty",
			rule: { game: { gameMixId: mix.id }, stakes },
		});
		expect(statements).toBeLessThan(1000);
		statements = 0;
		await caller.ringGame.update({
			id: game.id,
			rule: { stakes, minBuyIn: 50 },
		});
		expect(statements).toBeLessThan(1000);
		expect(game.ruleVersion.stakes).toHaveLength(30);
		expect(game.lineups[game.ruleVersion.lineupId]?.groups).toHaveLength(30);
		expect(game.ruleVersion.stakes.map((stake) => stake.blind1)).toEqual(
			stakes.map((stake) => stake.blind1)
		);
	});

	test("reuses identical versions, preserves history and restores without inserting a version", async ({
		api,
	}) => {
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const variant = (await api.alice.gameVariant.list())[0];
		if (!variant) {
			throw new Error("Missing seeded variant");
		}
		const original = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Cash",
			rule: { game: { variantId: variant.id }, minBuyIn: 100, maxBuyIn: 200 },
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
		const first = variants[0];
		const second = variants[1];
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
			rule: { game: { variantId: variant.id } },
		});
		const mixed = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Mixed",
			rule: { game: { gameMixId: mix.id } },
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
				rule: { game: { variantId: variant.id } },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("rejects foreign versions, assets and stakes outside the lineup without partial writes", async ({
		api,
	}) => {
		await api.alice.gameVariant.list();
		await api.bob.gameVariant.list();
		const aliceRoom = requireCreatedRow(
			await api.alice.room.create({ name: "Alice" })
		);
		const bobRoom = requireCreatedRow(
			await api.bob.room.create({ name: "Bob" })
		);
		const alice = await api.alice.ringGame.create({
			roomId: aliceRoom.id,
			name: "A",
			rule: {},
		});
		const other = await api.alice.ringGame.create({
			roomId: aliceRoom.id,
			name: "Other",
			rule: {},
		});
		const bob = await api.bob.ringGame.create({
			roomId: bobRoom.id,
			name: "B",
			rule: {},
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
		await api.alice.gameVariant.list();
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await expect(
			api.alice.ringGame.create({
				roomId: room.id,
				name: "Invalid",
				rule: { minBuyIn: 200, maxBuyIn: 100 },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const game = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Valid",
			rule: { minBuyIn: 100, maxBuyIn: 200 },
		});
		await expect(
			api.alice.ringGame.update({ id: game.id, rule: { minBuyIn: 201 } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
