import { entry } from "@sapphire2/db/schema/entry";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { tournamentRuleLevel } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { describe, expect } from "vitest";
import { requireCreatedRow, test } from "./test-fixture";

const day = new Date("2026-09-05T00:00:00.000Z");
const conflictMessage =
	"This room is referenced by sessions or games. Archive the room instead of deleting it.";

describe("room lifecycle on D1", () => {
	for (const reference of ["entry", "ring game", "tournament"] as const) {
		test(`refuses deleting a room referenced by a ${reference} and preserves its children`, async ({
			api,
		}) => {
			const club = requireCreatedRow(
				await api.alice.room.create({ name: "Club" })
			);
			if (reference === "entry") {
				await api.db.insert(entry).values({
					id: "session",
					userId: "alice",
					kind: "cash",
					status: "settled",
					source: "manual",
					playedOn: "2026-09-05",
					roomId: club.id,
					updatedAt: day,
				});
			} else if (reference === "ring game") {
				const nlh = (await api.alice.gameVariant.list()).find(
					(row) => row.builtinKey === "nlh"
				);
				if (!nlh) {
					throw new Error("missing builtin nlh");
				}
				const game = requireCreatedRow(
					await api.alice.ringGame.create({
						roomId: club.id,
						name: "Cash",
						rule: {
							game: { variantId: nlh.id },
							stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
						},
					})
				);
				await api.alice.ringGame.archive({ id: game.id });
			} else {
				const nlh = (await api.alice.gameVariant.list()).find(
					(row) => row.builtinKey === "nlh"
				);
				if (!nlh) {
					throw new Error("missing builtin nlh");
				}
				const created = await api.alice.tournament.createWithLevels({
					roomId: club.id,
					name: "Tournament",
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
				});
				await api.alice.tournament.archive({ id: created.id });
			}
			expect(await api.alice.room.list()).toEqual([
				expect.objectContaining({ id: club.id, isReferenced: true }),
			]);
			const before = {
				rooms: await api.db.select().from(room),
				entries: await api.db.select().from(entry),
				games: await api.db.select().from(ringGame),
				tournaments: await api.db.select().from(tournament),
				levels: await api.db.select().from(tournamentRuleLevel),
			};
			await expect(
				api.alice.room.delete({ id: club.id })
			).rejects.toMatchObject({ code: "CONFLICT", message: conflictMessage });
			expect({
				rooms: await api.db.select().from(room),
				entries: await api.db.select().from(entry),
				games: await api.db.select().from(ringGame),
				tournaments: await api.db.select().from(tournament),
				levels: await api.db.select().from(tournamentRuleLevel),
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
		await api.db.insert(entry).values({
			id: "session",
			userId: "alice",
			kind: "cash",
			status: "settled",
			source: "manual",
			playedOn: "2026-09-05",
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
		expect(await api.db.select().from(entry)).toEqual([
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
		expect(await api.alice.room.list({ includeArchived: true })).toEqual([
			expect.objectContaining({ id: club.id, archivedAt: null }),
		]);
	});

	test("rejects another user's and missing rooms uniformly before lifecycle changes", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.bob.room.create({ name: "Bob's room" })
		);
		const nlh = (await api.bob.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!nlh) {
			throw new Error("missing builtin nlh");
		}
		await api.bob.ringGame.create({
			roomId: club.id,
			name: "Cash",
			rule: {
				game: { variantId: nlh.id },
				stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
			},
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
