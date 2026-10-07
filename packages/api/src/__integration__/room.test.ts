import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");
const conflictMessage =
	"This room is referenced by sessions or games. Archive the room instead of deleting it.";

describe("room lifecycle on D1", () => {
	for (const reference of ["session", "ring game", "tournament"] as const) {
		test(`refuses deleting a room referenced by a ${reference} and preserves its children`, async ({
			api,
		}) => {
			const club = requireCreatedRow(
				await api.alice.room.create({ name: "Club" })
			);
			if (reference === "session") {
				await api.db.insert(gameSession).values({
					id: "session",
					userId: "alice",
					kind: "cash_game",
					status: "completed",
					source: "manual",
					sessionDate: day,
					roomId: club.id,
					updatedAt: day,
				});
			} else if (reference === "ring game") {
				await api.db.insert(ringGame).values({
					id: "game",
					userId: "alice",
					name: "Cash",
					roomId: club.id,
					archivedAt: day,
					updatedAt: day,
				});
			} else {
				await api.db.insert(tournament).values({
					id: "tournament",
					name: "Tournament",
					roomId: club.id,
					archivedAt: day,
					updatedAt: day,
				});
				await api.db
					.insert(blindLevel)
					.values({ id: "level", tournamentId: "tournament", level: 1 });
			}
			expect(await api.alice.room.list()).toEqual([
				expect.objectContaining({ id: club.id, isReferenced: true }),
			]);
			const before = {
				rooms: await api.db.select().from(room),
				sessions: await api.db.select().from(gameSession),
				games: await api.db.select().from(ringGame),
				tournaments: await api.db.select().from(tournament),
				levels: await api.db.select().from(blindLevel),
			};
			await expect(
				api.alice.room.delete({ id: club.id })
			).rejects.toMatchObject({ code: "CONFLICT", message: conflictMessage });
			expect({
				rooms: await api.db.select().from(room),
				sessions: await api.db.select().from(gameSession),
				games: await api.db.select().from(ringGame),
				tournaments: await api.db.select().from(tournament),
				levels: await api.db.select().from(blindLevel),
			}).toEqual(before);
		});
	}

	test("deletes an unreferenced room and leaves other rooms intact", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Unused" })
		);
		const other = requireCreatedRow(
			await api.bob.room.create({ name: "Other" })
		);
		expect(await api.alice.room.list()).toEqual([
			expect.objectContaining({ id: club.id, isReferenced: false }),
		]);
		expect(await api.alice.room.delete({ id: club.id })).toEqual({
			success: true,
		});
		expect(await api.db.select().from(room)).toEqual([other]);
	});

	test("archives and restores a referenced room without losing its links or name", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		await api.db.insert(gameSession).values({
			id: "session",
			userId: "alice",
			kind: "cash_game",
			status: "completed",
			source: "manual",
			sessionDate: day,
			roomId: club.id,
			updatedAt: day,
		});
		const archived = requireCreatedRow(
			await api.alice.room.archive({ id: club.id })
		);
		expect(archived.archivedAt).toBeInstanceOf(Date);
		expect(archived.updatedAt).toEqual(archived.archivedAt);
		expect(await api.alice.room.list()).toEqual([]);
		expect(await api.alice.room.list({ includeArchived: false })).toEqual([]);
		expect(await api.alice.room.list({ includeArchived: true })).toEqual([
			expect.objectContaining({
				id: club.id,
				archivedAt: archived.archivedAt,
				isReferenced: true,
			}),
		]);
		expect(await api.alice.room.getById({ id: club.id })).toEqual(archived);
		expect(await api.db.select().from(gameSession)).toEqual([
			expect.objectContaining({ id: "session", roomId: club.id }),
		]);
		const restored = requireCreatedRow(
			await api.alice.room.restore({ id: club.id })
		);
		expect(restored).toMatchObject({
			id: club.id,
			name: "Club",
			archivedAt: null,
		});
		expect(restored.updatedAt).toBeInstanceOf(Date);
		expect(await api.db.select().from(room)).toEqual([restored]);
		expect(await api.alice.room.list()).toEqual([
			expect.objectContaining({ id: club.id, archivedAt: null }),
		]);
		expect(await api.alice.room.list({ includeArchived: true })).toEqual([]);
	});

	test("rejects another user's and missing rooms uniformly before lifecycle changes", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.bob.room.create({ name: "Bob's room" })
		);
		await api.db.insert(ringGame).values({
			id: "game",
			userId: "bob",
			name: "Cash",
			roomId: club.id,
			updatedAt: day,
		});
		const before = await api.db.select().from(room);
		for (const id of [club.id, "missing"]) {
			for (const mutate of [
				api.alice.room.archive,
				api.alice.room.restore,
				api.alice.room.delete,
			]) {
				await expect(mutate({ id })).rejects.toMatchObject({
					code: "FORBIDDEN",
					message: "You do not own this room",
				});
			}
		}
		expect(await api.alice.room.list({ includeArchived: true })).toEqual([]);
		expect(await api.db.select().from(room)).toEqual(before);
	});
});
