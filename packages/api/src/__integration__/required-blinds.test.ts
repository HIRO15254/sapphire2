import { describe, expect } from "vitest";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

async function setup(api: ApiFixture) {
	const variants = await api.alice.gameVariant.list();
	const nlh = variants.find((row) => row.builtinKey === "nlh");
	if (!nlh) {
		throw new Error("missing builtin nlh");
	}
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const group = requireCreatedRow(
		await api.alice.gameGroup.create({
			blind1Label: "Small",
			blind2Label: "Big",
			label: "Double Board",
		})
	);
	const variant = requireCreatedRow(
		await api.alice.gameVariant.create({
			groupId: group.id,
			label: "Double Board PLO",
		})
	);
	return { group, nlh, room, variant };
}

describe("required blinds on D1", () => {
	test("new stakes must fill required blinds and leave unlabeled fields empty", async ({
		api,
	}) => {
		const { room, nlh } = await setup(api);
		const game = { variantId: nlh.id };
		for (const stake of [
			{ blind1: 1, gameGroupId: nlh.groupId },
			{ blind1: 1, blind2: 2, blind3: 4, gameGroupId: nlh.groupId },
		]) {
			await expect(
				api.alice.ringGame.create({
					name: "Cash",
					roomId: room.id,
					rule: { game, stakes: [stake] },
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				api.alice.tournament.createWithLevels({
					name: "Daily",
					roomId: room.id,
					rule: {
						game,
						levels: [{ isBreak: false, minutes: 20, stakes: [stake] }],
					},
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				game,
				stakes: [{ ante: 2, blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
			},
		});
		expect(created.ruleVersion.stakes).toEqual([
			expect.objectContaining({ ante: 2, blind1: 1, blind2: 2, blind3: null }),
		]);
	});

	test("reusing an unchanged version skips the check, while a new version re-checks carried stakes", async ({
		api,
	}) => {
		const { room, group, variant } = await setup(api);
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: {
				game: { variantId: variant.id },
				stakes: [{ blind2: 2, gameGroupId: group.id }],
			},
		});
		await api.alice.gameGroup.update({ blind1Required: true, id: group.id });

		const kept = await api.alice.ringGame.update({
			id: created.id,
			rule: { stakes: [{ blind2: 2, gameGroupId: group.id }] },
		});
		expect(kept.currentRuleId).toBe(created.currentRuleId);
		await expect(
			api.alice.ringGame.update({ id: created.id, rule: { minBuyIn: 100 } })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test("a blind field can be required only while it has a label", async ({
		api,
	}) => {
		const { group } = await setup(api);
		await expect(
			api.alice.gameGroup.create({
				blind1Label: "Small",
				blind3Required: true,
				label: "Unlabeled",
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const required = await api.alice.gameGroup.update({
			blind2Required: true,
			id: group.id,
		});
		expect(required).toMatchObject({
			blind1Required: false,
			blind2Required: true,
			blind3Required: false,
		});
		await expect(
			api.alice.gameGroup.update({ blind2Label: null, id: group.id })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test.for(["cash", "tournament"] as const)(
		"clearing a label is a CONFLICT while a saved %s stake has a value there",
		async (kind, { api }) => {
			const { room, group, variant } = await setup(api);
			const game = { variantId: variant.id };
			const stake = { blind1: 1, blind2: 2, gameGroupId: group.id };
			if (kind === "cash") {
				await api.alice.ringGame.create({
					name: "Cash",
					roomId: room.id,
					rule: { game, stakes: [stake] },
				});
			} else {
				await api.alice.tournament.createWithLevels({
					name: "Daily",
					roomId: room.id,
					rule: {
						game,
						levels: [{ isBreak: false, minutes: 20, stakes: [stake] }],
					},
				});
			}

			await expect(
				api.alice.gameGroup.update({ blind2Label: null, id: group.id })
			).rejects.toMatchObject({ code: "CONFLICT" });
			expect(
				(await api.alice.gameGroup.list()).find((row) => row.id === group.id)
			).toMatchObject({ blind2Label: "Big" });
			await api.alice.gameGroup.update({
				blind3Label: "Straddle",
				id: group.id,
			});
			expect(
				await api.alice.gameGroup.update({ blind3Label: null, id: group.id })
			).toMatchObject({ blind3Label: null });
		}
	);
});
