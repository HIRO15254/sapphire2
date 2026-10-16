import { entry, entryCash, entryTournament } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { tournament } from "@sapphire2/db/schema/tournament";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const ARCHIVE_PATTERN = /archive/i;

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
				.from(entryCash)
				.where(eq(entryCash.entryId, created.id));
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

describe("master deletion preserves entry references on D1", () => {
	for (const kind of ["cash", "tournament"] as const) {
		test(`${kind}: protects referenced masters and deletes unreferenced masters`, async ({
			api,
		}) => {
			const room = requireCreatedRow(
				await api.alice.room.create({ name: "Club" })
			);
			const master = requireCreatedRow(
				kind === "cash"
					? await api.alice.ringGame.create({ roomId: room.id, name: "Cash" })
					: await api.alice.tournament.create({
							roomId: room.id,
							name: "Daily",
						})
			);
			const table = kind === "cash" ? ringGame : tournament;
			const owner = kind === "cash" ? api.alice.ringGame : api.alice.tournament;
			const other = kind === "cash" ? api.bob.ringGame : api.bob.tournament;
			await api.db.insert(entry).values({
				id: "referencing-entry",
				userId: "alice",
				kind,
				source: "manual",
				status: "settled",
				playedOn: "2026-09-05",
			});
			if (kind === "cash") {
				await api.db.insert(entryCash).values({
					entryId: "referencing-entry",
					userId: "alice",
					ringGameId: master.id,
				});
			} else {
				await api.db.insert(entryTournament).values({
					entryId: "referencing-entry",
					userId: "alice",
					tournamentId: master.id,
				});
			}
			const before = await api.db.select().from(table);
			for (const id of [master.id, "missing-master"]) {
				await expect(other.delete({ id })).rejects.toMatchObject({
					code: "FORBIDDEN",
				});
			}
			await expect(
				owner.delete({ id: "missing-master" })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
			await expect(owner.delete({ id: master.id })).rejects.toMatchObject({
				code: "CONFLICT",
				message: expect.stringMatching(ARCHIVE_PATTERN),
			});
			expect(await api.db.select().from(table)).toEqual(before);
			expect(await api.db.select().from(entry)).toEqual([
				expect.objectContaining({ id: "referencing-entry", userId: "alice" }),
			]);
			if (kind === "cash") {
				expect(await api.db.select().from(entryCash)).toEqual([
					expect.objectContaining({ ringGameId: master.id }),
				]);
			} else {
				expect(await api.db.select().from(entryTournament)).toEqual([
					expect.objectContaining({ tournamentId: master.id }),
				]);
			}
			await api.db.delete(entry).where(eq(entry.id, "referencing-entry"));
			await expect(owner.delete({ id: master.id })).resolves.toEqual({
				success: true,
			});
			expect(await api.db.select().from(table)).toEqual([]);
		});
	}
});
