import { ringGame } from "@sapphire2/db/schema/ring-game";
import { tournament } from "@sapphire2/db/schema/tournament";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

describe("new masters persist the caller's ownership on D1", () => {
	for (const userId of ["alice", "bob"] as const) {
		test(`${userId}: tournament.create stores user_id`, async ({ api }) => {
			const caller = api.caller(userId);
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const created = requireCreatedRow(
				await caller.tournament.create({
					roomId: room.id,
					name: "Daily",
					rule: {},
				})
			);
			expect(
				await api.db
					.select()
					.from(tournament)
					.where(eq(tournament.id, created.id))
			).toEqual([expect.objectContaining({ userId })]);
		});

		test(`${userId}: tournament.createWithLevels stores user_id`, async ({
			api,
		}) => {
			const caller = api.caller(userId);
			const nlh = (await caller.gameVariant.list()).find(
				(row) => row.builtinKey === "nlh"
			);
			if (!nlh) {
				throw new Error("missing builtin nlh");
			}
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const created = requireCreatedRow(
				await caller.tournament.createWithLevels({
					roomId: room.id,
					name: "Deepstack",
					rule: {
						game: { variantId: nlh.id },
						levels: [
							{
								isBreak: false,
								minutes: 20,
								stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
							},
						],
					},
				})
			);
			expect(
				await api.db
					.select()
					.from(tournament)
					.where(eq(tournament.id, created.id))
			).toEqual([expect.objectContaining({ userId })]);
		});

		test(`${userId}: ringGame.create stores user_id`, async ({ api }) => {
			const caller = api.caller(userId);
			const nlh = (await caller.gameVariant.list()).find(
				(row) => row.builtinKey === "nlh"
			);
			if (!nlh) {
				throw new Error("missing builtin nlh");
			}
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const created = requireCreatedRow(
				await caller.ringGame.create({
					roomId: room.id,
					name: "Cash",
					rule: {
						game: { variantId: nlh.id },
						stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
					},
				})
			);
			expect(
				await api.db.select().from(ringGame).where(eq(ringGame.id, created.id))
			).toEqual([expect.objectContaining({ userId })]);
		});
	}
});
