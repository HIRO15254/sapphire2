import { describe, expect } from "vitest";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

type Kind = "cash" | "tournament";

interface Stake {
	ante?: number | null;
	anteType?: "all" | "bb" | "none" | null;
	blind1?: number;
	blind2?: number;
	gameGroupId: string;
}

async function setup(api: ApiFixture) {
	const groups = await api.alice.gameGroup.list();
	const stud = groups.find((row) => row.builtinKey === "stud");
	const variants = await api.alice.gameVariant.list();
	const studVariant = variants.find((row) => row.groupId === stud?.id);
	if (!(stud && studVariant)) {
		throw new Error("missing builtin stud");
	}
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	return { room, stud, studVariant };
}

async function write(
	api: ApiFixture,
	kind: Kind,
	roomId: string,
	variantId: string,
	stake: Stake
) {
	const game = { variantId };
	if (kind === "cash") {
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId,
			rule: { game, stakes: [stake] },
		});
		return created.ruleVersion.stakes[0];
	}
	const created = await api.alice.tournament.createWithLevels({
		name: "Daily",
		roomId,
		rule: { game, levels: [{ isBreak: false, minutes: 20, stakes: [stake] }] },
	});
	return created.ruleVersion.levels[0]?.stakes[0];
}

describe("fixed ante type on D1", () => {
	test.for(["cash", "tournament"] as const)(
		"a %s stake on built-in Stud takes the fixed type, keeps a matching one and rejects another",
		async (kind, { api }) => {
			const { room, stud, studVariant } = await setup(api);
			expect(stud.fixedAnteType).toBe("all");
			const blinds = { blind1: 10, blind2: 20, gameGroupId: stud.id };

			expect(
				await write(api, kind, room.id, studVariant.id, { ...blinds, ante: 2 })
			).toMatchObject({ ante: 2, anteType: "all" });
			expect(
				await write(api, kind, room.id, studVariant.id, {
					...blinds,
					ante: 2,
					anteType: "all",
				})
			).toMatchObject({ ante: 2, anteType: "all" });
			await expect(
				write(api, kind, room.id, studVariant.id, {
					...blinds,
					ante: 2,
					anteType: "bb",
				})
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
	);

	test.for(["cash", "tournament"] as const)(
		"a %s stake on a user structure fixed to none rejects an ante amount",
		async (kind, { api }) => {
			const { room } = await setup(api);
			const group = requireCreatedRow(
				await api.alice.gameGroup.create({
					blind1Label: "Small",
					blind2Label: "Big",
					fixedAnteType: "none",
					label: "No Ante Limit",
				})
			);
			expect(group.fixedAnteType).toBe("none");
			const variant = requireCreatedRow(
				await api.alice.gameVariant.create({
					groupId: group.id,
					label: "Five Card Limit",
				})
			);
			const blinds = { blind1: 10, blind2: 20, gameGroupId: group.id };

			await expect(
				write(api, kind, room.id, variant.id, { ...blinds, ante: 5 })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(await write(api, kind, room.id, variant.id, blinds)).toMatchObject(
				{ ante: null, anteType: "none" }
			);
		}
	);

	test("a changed setting leaves saved stakes and unchanged versions alone, and applies to the next supplied stakes", async ({
		api,
	}) => {
		const { room } = await setup(api);
		const group = requireCreatedRow(
			await api.alice.gameGroup.create({
				blind1Label: "SB",
				blind2Label: "BB",
				label: "Short Deck",
			})
		);
		const variant = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: group.id,
				label: "Short Deck Hold'em",
			})
		);
		const stake = {
			ante: 5,
			anteType: "bb" as const,
			blind1: 1,
			blind2: 2,
			gameGroupId: group.id,
		};
		const created = await api.alice.ringGame.create({
			name: "Cash",
			roomId: room.id,
			rule: { game: { variantId: variant.id }, stakes: [stake] },
		});

		expect(
			await api.alice.gameGroup.update({ fixedAnteType: "all", id: group.id })
		).toMatchObject({ fixedAnteType: "all" });

		const kept = await api.alice.ringGame.update({
			id: created.id,
			rule: { stakes: [stake] },
		});
		expect(kept.currentRuleId).toBe(created.currentRuleId);
		const carried = await api.alice.ringGame.update({
			id: created.id,
			rule: { minBuyIn: 100 },
		});
		expect(carried.ruleVersion.stakes[0]).toMatchObject({ anteType: "bb" });
		await expect(
			api.alice.ringGame.update({
				id: created.id,
				rule: { stakes: [{ ...stake, ante: 6 }] },
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(
			await api.alice.gameGroup.update({ fixedAnteType: null, id: group.id })
		).toMatchObject({ fixedAnteType: null });
		expect(
			(
				await api.alice.ringGame.update({
					id: created.id,
					rule: { stakes: [{ ...stake, ante: 6 }] },
				})
			).ruleVersion.stakes[0]
		).toMatchObject({ ante: 6, anteType: "bb" });
	});
});
