import { describe, expect } from "vitest";
import { MAX_MIX_GAMES } from "../routers/game-mix";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

async function builtinVariants(api: ApiFixture) {
	const variants = await api.alice.gameVariant.list();
	const byKey = (key: string) => {
		const found = variants.find((row) => row.builtinKey === key);
		if (!found) {
			throw new Error(`missing builtin ${key}`);
		}
		return found;
	};
	return { lo: byKey("lo"), nlh: byKey("nlh"), razz: byKey("razz") };
}

describe("unordered game mixes on D1", () => {
	test("stores any order of the same games in structure order and reuses the lineup", async ({
		api,
	}) => {
		const { lo, nlh, razz } = await builtinVariants(api);
		const mix = requireCreatedRow(
			await api.alice.gameMix.create({
				games: [razz.id, nlh.id, lo.id],
				label: "Three",
			})
		);
		const canonical = [lo.id, razz.id, nlh.id];
		expect(mix.games).toEqual(canonical);

		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const stakes = [
			{ blind1: 2, blind2: 4, gameGroupId: lo.groupId },
			{ blind1: 2, blind2: 4, gameGroupId: razz.groupId },
			{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId },
		];
		const ring = await api.alice.ringGame.create({
			name: "Mixed",
			roomId: room.id,
			rule: { game: { gameMixId: mix.id }, stakes },
		});

		expect(
			await api.alice.gameMix.update({
				games: [nlh.id, lo.id, razz.id],
				id: mix.id,
			})
		).toMatchObject({ games: canonical });
		const resaved = await api.alice.ringGame.update({
			id: ring.id,
			rule: { game: { gameMixId: mix.id }, stakes },
		});
		expect(resaved.ruleVersion.lineupId).toBe(ring.ruleVersion.lineupId);
		expect(resaved.currentRuleId).toBe(ring.currentRuleId);
	});

	test("rejects a second mix of the same games, archived or built-in included", async ({
		api,
	}) => {
		const { lo, nlh, razz } = await builtinVariants(api);
		const first = requireCreatedRow(
			await api.alice.gameMix.create({ games: [lo.id, razz.id], label: "Pair" })
		);
		await api.alice.gameMix.archive({ id: first.id });

		await expect(
			api.alice.gameMix.create({ games: [razz.id, lo.id], label: "Pair 2" })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Same games as Pair",
		});
		const other = requireCreatedRow(
			await api.alice.gameMix.create({ games: [lo.id, nlh.id], label: "Other" })
		);
		await expect(
			api.alice.gameMix.update({ games: [razz.id, lo.id], id: other.id })
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Same games as Pair",
		});

		const horse = (await api.alice.gameMix.list()).find(
			(row) => row.builtinKey === "horse"
		);
		await expect(
			api.alice.gameMix.create({
				games: [...(horse?.games ?? [])].reverse(),
				label: "My HORSE",
			})
		).rejects.toMatchObject({
			code: "CONFLICT",
			message: "Same games as HORSE",
		});
		expect(
			await api.alice.gameMix.update({
				games: [razz.id, lo.id],
				id: first.id,
				label: "Pair renamed",
			})
		).toMatchObject({ label: "Pair renamed" });
	});

	test(`creates and replaces a ${MAX_MIX_GAMES}-game mix`, async ({ api }) => {
		const group = requireCreatedRow(
			await api.alice.gameGroup.create({
				blind1Label: "SB",
				blind2Label: "BB",
				label: "Dealer's Choice",
			})
		);
		const builtin = (await api.alice.gameVariant.list()).map((row) => row.id);
		const custom: string[] = [];
		for (const index of Array.from(
			{ length: MAX_MIX_GAMES - builtin.length },
			(_, value) => value
		)) {
			custom.push(
				requireCreatedRow(
					// biome-ignore lint/performance/noAwaitInLoops: Variants are created one by one through the API.
					await api.alice.gameVariant.create({
						groupId: group.id,
						label: `Choice ${index}`,
					})
				).id
			);
		}
		const all = [...custom, ...builtin];
		const created = requireCreatedRow(
			await api.alice.gameMix.create({ games: all, label: "Everything" })
		);
		expect(created.games).toHaveLength(MAX_MIX_GAMES);
		expect(new Set(created.games)).toEqual(new Set(all));

		const replaced = await api.alice.gameMix.update({
			games: all.slice(1).reverse(),
			id: created.id,
		});
		expect(new Set(replaced?.games)).toEqual(new Set(all.slice(1)));
		await expect(
			api.alice.gameMix.create({
				games: [...all, all[0] ?? ""],
				label: "Too many",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
