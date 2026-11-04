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
				await caller.tournament.create({ roomId: room.id, name: "Daily" })
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
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const created = requireCreatedRow(
				await caller.tournament.createWithLevels({
					roomId: room.id,
					name: "Deepstack",
					blindLevels: [
						{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 },
					],
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
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const created = requireCreatedRow(
				await caller.ringGame.create({ roomId: room.id, name: "Cash" })
			);
			expect(
				await api.db.select().from(ringGame).where(eq(ringGame.id, created.id))
			).toEqual([expect.objectContaining({ userId })]);
		});
	}
});
