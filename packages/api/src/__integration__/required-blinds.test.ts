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
			label: "Double Board",
			blind1Label: "Small",
			blind2Label: "Big",
		})
	);
	const variant = requireCreatedRow(
		await api.alice.gameVariant.create({
			label: "Double Board PLO",
			groupId: group.id,
		})
	);
	return { room, nlh, group, variant };
}

describe("required blinds on D1", () => {
	test("new stakes must fill required blinds and leave unlabeled fields empty", async ({
		api,
	}) => {
		const { room, nlh } = await setup(api);
		const game = { variantId: nlh.id };
		for (const stake of [
			{ gameGroupId: nlh.groupId, blind1: 1 },
			{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2, blind3: 4 },
		]) {
			await expect(
				api.alice.ringGame.create({
					roomId: room.id,
					name: "Cash",
					rule: { game, stakes: [stake] },
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				api.alice.tournament.createWithLevels({
					roomId: room.id,
					name: "Daily",
					rule: {
						game,
						levels: [{ isBreak: false, minutes: 20, stakes: [stake] }],
					},
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
		const created = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Cash",
			rule: {
				game,
				stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2, ante: 2 }],
			},
		});
		expect(created.ruleVersion.stakes).toEqual([
			expect.objectContaining({ blind1: 1, blind2: 2, blind3: null, ante: 2 }),
		]);
	});

	test("reusing an unchanged version skips the check, while a new version re-checks carried stakes", async ({
		api,
	}) => {
		const { room, group, variant } = await setup(api);
		const created = await api.alice.ringGame.create({
			roomId: room.id,
			name: "Cash",
			rule: {
				game: { variantId: variant.id },
				stakes: [{ gameGroupId: group.id, blind2: 2 }],
			},
		});
		await api.alice.gameGroup.update({ id: group.id, blind1Required: true });

		const kept = await api.alice.ringGame.update({
			id: created.id,
			rule: { stakes: [{ gameGroupId: group.id, blind2: 2 }] },
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
				label: "Unlabeled",
				blind1Label: "Small",
				blind3Required: true,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		const required = await api.alice.gameGroup.update({
			id: group.id,
			blind2Required: true,
		});
		expect(required).toMatchObject({
			blind1Required: false,
			blind2Required: true,
			blind3Required: false,
		});
		await expect(
			api.alice.gameGroup.update({ id: group.id, blind2Label: null })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	test.for([
		"cash",
		"tournament",
	] as const)("clearing a label is a CONFLICT while a saved %s stake has a value there", async (kind, {
		api,
	}) => {
		const { room, group, variant } = await setup(api);
		const game = { variantId: variant.id };
		const stake = { gameGroupId: group.id, blind1: 1, blind2: 2 };
		if (kind === "cash") {
			await api.alice.ringGame.create({
				roomId: room.id,
				name: "Cash",
				rule: { game, stakes: [stake] },
			});
		} else {
			await api.alice.tournament.createWithLevels({
				roomId: room.id,
				name: "Daily",
				rule: {
					game,
					levels: [{ isBreak: false, minutes: 20, stakes: [stake] }],
				},
			});
		}

		await expect(
			api.alice.gameGroup.update({ id: group.id, blind2Label: null })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.gameGroup.list()).find((row) => row.id === group.id)
		).toMatchObject({ blind2Label: "Big" });
		await api.alice.gameGroup.update({ id: group.id, blind3Label: "Straddle" });
		expect(
			await api.alice.gameGroup.update({ id: group.id, blind3Label: null })
		).toMatchObject({ blind3Label: null });
	});
});
