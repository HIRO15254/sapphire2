import { ringGame } from "@sapphire2/db/schema/ring-game";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
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

		test(`${userId}: live tournament master creation stores user_id`, async ({
			api,
		}) => {
			const caller = api.caller(userId);
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const session = requireCreatedRow(
				await caller.liveTournamentSession.create({ buyIn: 100 })
			);
			const created =
				await caller.liveTournamentSession.createAndAssignTournament({
					sessionId: session.id,
					roomId: room.id,
					name: "Live deepstack",
				});
			expect(
				await api.db
					.select()
					.from(tournament)
					.where(eq(tournament.id, created.tournamentId))
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

		test(`${userId}: manual cash session's roomless master stores user_id`, async ({
			api,
		}) => {
			const created = requireCreatedRow(
				await api.caller(userId).session.create({
					type: "cash_game",
					sessionDate: Date.UTC(2026, 8, 1) / 1000,
					buyIn: 100,
					cashOut: 150,
				})
			);
			const [detail] = await api.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, created.id));
			expect(detail?.ringGameId).toEqual(expect.any(String));
			expect(await api.db.select().from(ringGame)).toEqual([
				expect.objectContaining({
					id: detail?.ringGameId,
					userId,
					roomId: null,
				}),
			]);
		});

		test(`${userId}: live cash master creation stores user_id`, async ({
			api,
		}) => {
			const caller = api.caller(userId);
			const room = requireCreatedRow(
				await caller.room.create({ name: "Club" })
			);
			const session = requireCreatedRow(
				await caller.liveCashGameSession.create({ initialBuyIn: 100 })
			);
			const created = await caller.liveCashGameSession.createAndAssignRingGame({
				sessionId: session.id,
				roomId: room.id,
				name: "Live cash",
			});
			expect(
				await api.db
					.select()
					.from(ringGame)
					.where(eq(ringGame.id, created.ringGameId))
			).toEqual([expect.objectContaining({ userId })]);
		});
	}
});
