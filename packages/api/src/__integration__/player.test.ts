import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";
import { requireCreatedRow, test } from "./test-fixture";

describe("player tags and atomic writes on D1", () => {
	test("rejects valid unauthenticated player requests without reading or changing stored players", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.player.create({ name: "Private player" })
		);
		const before = await api.db.select().from(player);
		const guest = api.caller(null);
		for (const request of [
			() => guest.player.list(),
			() => guest.player.getById({ id: saved.id }),
			() => guest.player.create({ name: "Valid" }),
			() => guest.player.update({ id: saved.id, name: "Changed" }),
			() => guest.player.delete({ id: saved.id }),
		]) {
			await expect(request()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		}
		expect(await api.db.select().from(player)).toEqual(before);
	});

	test("rejects foreign and nonexistent player IDs uniformly without changing tags or players", async ({
		api,
	}) => {
		const tag = requireCreatedRow(
			await api.bob.playerTag.create({ name: "Private tag" })
		);
		const saved = requireCreatedRow(
			await api.bob.player.create({
				name: "Private player",
				tagIds: [tag.id],
			})
		);
		const playersBefore = await api.db.select().from(player);
		const linksBefore = await api.db.select().from(playerToPlayerTag);
		for (const id of [saved.id, "missing-player"]) {
			await expect(api.alice.player.getById({ id })).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
			await expect(
				api.alice.player.update({ id, name: "Rejected", tagIds: [] })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
			await expect(api.alice.player.delete({ id })).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
		}
		expect(await api.db.select().from(player)).toEqual(playersBefore);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual(linksBefore);
	});

	test("omitted tagIds preserves associations while updating another field", async ({
		api,
	}) => {
		const tag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Keep tag" })
		);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Before",
				tagIds: [tag.id],
			})
		);
		await api.alice.player.update({ id: saved.id, name: "After" });
		expect(await api.alice.player.getById({ id: saved.id })).toMatchObject({
			name: "After",
			tags: [{ id: tag.id }],
		});
	});

	test("an id-only update returns the existing player and leaves stored state unchanged", async ({
		api,
	}) => {
		const saved = requireCreatedRow(
			await api.alice.player.create({ name: "No changes" })
		);
		const before = await api.db.select().from(player);
		expect(await api.alice.player.update({ id: saved.id })).toMatchObject({
			id: saved.id,
			name: "No changes",
			tags: [],
		});
		expect(await api.db.select().from(player)).toEqual(before);
	});

	test("filters and hydrates more than 100 matching players without duplicates or foreign rows", async ({
		api,
	}) => {
		const tag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Shared tag" })
		);
		const secondTag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Second tag" })
		);
		const count = D1_MAX_BOUND_PARAMS + 1;
		const ids = Array.from(
			{ length: count },
			(_, index) => `matching-player-${index}`
		);
		for (const id of ids) {
			await api.db.insert(player).values({
				id,
				userId: "alice",
				name: `Match ${id}`,
				updatedAt: new Date("2026-09-05"),
			});
			await api.db.insert(playerToPlayerTag).values([
				{ playerId: id, playerTagId: tag.id, position: 0 },
				{ playerId: id, playerTagId: secondTag.id, position: 1 },
			]);
		}
		const foreign = requireCreatedRow(
			await api.bob.player.create({ name: "Match private" })
		);
		await api.db
			.insert(playerToPlayerTag)
			.values({ playerId: foreign.id, playerTagId: tag.id, position: 0 });
		const result = await api.alice.player.list({
			search: "Match",
			tagIds: [tag.id, secondTag.id],
		});
		expect(result.map(({ id }) => id).sort()).toEqual(ids.sort());
		for (const item of result) {
			expect(item.tags.map(({ id }) => id)).toEqual([tag.id, secondTag.id]);
		}
	});

	test("persists ordered tags, searches owned players and clears only the updated player's links", async ({
		api,
	}) => {
		const aggressive = requireCreatedRow(
			await api.alice.playerTag.create({
				name: "Aggressive",
				color: "red",
			})
		);
		const regular = requireCreatedRow(
			await api.alice.playerTag.create({
				name: "Regular",
				color: "blue",
			})
		);
		const created = requireCreatedRow(
			await api.alice.player.create({
				name: "Alex",
				memo: "Initial read",
				tagIds: [regular.id, aggressive.id],
			})
		);
		const other = requireCreatedRow(
			await api.alice.player.create({
				name: "Morgan",
				tagIds: [regular.id],
			})
		);
		await api.bob.player.create({ name: "Alex (private)" });
		expect(
			await api.caller("alice").player.getById({ id: created.id })
		).toMatchObject({
			name: "Alex",
			memo: "Initial read",
			tags: [{ id: regular.id }, { id: aggressive.id }],
		});
		expect(
			(
				await api.alice.player.list({ search: "Alex", tagIds: [regular.id] })
			).map(({ id }) => id)
		).toEqual([created.id]);
		await api.alice.player.update({
			id: created.id,
			name: "Alex updated",
			memo: null,
			tagIds: [],
		});
		expect(await api.alice.player.getById({ id: created.id })).toMatchObject({
			name: "Alex updated",
			memo: null,
			tags: [],
		});
		expect(await api.alice.player.getById({ id: other.id })).toMatchObject({
			tags: [{ id: regular.id }],
		});
		await api.alice.player.delete({ id: other.id });
		expect(
			await api.db
				.select()
				.from(playerToPlayerTag)
				.where(eq(playerToPlayerTag.playerId, other.id))
		).toEqual([]);
	});

	test("rejects foreign tag IDs in create, replacement and filter before any persistent change", async ({
		api,
	}) => {
		const owned = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Owned" })
		);
		const foreign = requireCreatedRow(
			await api.bob.playerTag.create({ name: "Private" })
		);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Original",
				tagIds: [owned.id],
			})
		);
		const beforePlayers = await api.db.select().from(player);
		const beforeLinks = await api.db.select().from(playerToPlayerTag);
		for (const id of [foreign.id, "missing-tag"]) {
			await expect(
				api.alice.player.create({ name: "Rejected", tagIds: [owned.id, id] })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.player.update({
					id: saved.id,
					name: "Rejected",
					tagIds: [id],
				})
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			await expect(
				api.alice.player.list({ tagIds: [id] })
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await api.db.select().from(player)).toEqual(beforePlayers);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual(beforeLinks);
	});

	test("omits foreign tag names from list and detail even when legacy cross-account links exist", async ({
		api,
	}) => {
		const ownTag = requireCreatedRow(
			await api.alice.playerTag.create({
				name: "Visible",
				color: "green",
			})
		);
		const privateTag = requireCreatedRow(
			await api.bob.playerTag.create({
				name: "Secret scouting",
				color: "red",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Public to Alice",
				tagIds: [ownTag.id],
			})
		);

		await api.db
			.insert(playerToPlayerTag)
			.values({ playerId: saved.id, playerTagId: privateTag.id, position: 1 });
		const expectedTags = [{ id: ownTag.id, name: "Visible", color: "green" }];
		expect((await api.alice.player.getById({ id: saved.id })).tags).toEqual(
			expectedTags
		);
		expect((await api.alice.player.list())[0]?.tags).toEqual(expectedTags);
		const updated = await api.alice.player.update({
			id: saved.id,
			name: "Renamed",
		});
		expect(updated.tags).toEqual(expectedTags);
	});

	test("inserts more than one D1 binding chunk and preserves the supplied tag order", async ({
		api,
	}) => {
		const tagCount = Math.floor(D1_MAX_BOUND_PARAMS / 3) + 1;
		const ids = await api.createPlayerTags("alice", tagCount);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Many tags",
				tagIds: ids.toReversed(),
			})
		);
		expect(
			(await api.caller("alice").player.getById({ id: saved.id })).tags.map(
				({ id }) => id
			)
		).toEqual(ids.toReversed());
		expect(
			await api.db
				.select()
				.from(playerToPlayerTag)
				.where(eq(playerToPlayerTag.playerId, saved.id))
				.orderBy(asc(playerToPlayerTag.position))
		).toEqual(
			ids.toReversed().map((playerTagId, position) => ({
				playerId: saved.id,
				playerTagId,
				position,
			}))
		);
		await api.alice.player.update({ id: saved.id, tagIds: ids });
		expect(
			(await api.caller("alice").player.getById({ id: saved.id })).tags.map(
				({ id }) => id
			)
		).toEqual(ids);
	});

	test("rolls back the parent, deleted links and earlier insert chunk when a later statement fails", async ({
		api,
	}) => {
		const originalTag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Original" })
		);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Original name",
				memo: "Keep me",
				tagIds: [originalTag.id],
			})
		);
		const ids = await api.createPlayerTags(
			"alice",
			Math.floor(D1_MAX_BOUND_PARAMS / 3) + 1
		);
		const beforePlayer = await api.db
			.select()
			.from(player)
			.where(eq(player.id, saved.id));
		const beforeLinks = await api.db.select().from(playerToPlayerTag);

		await api.d1
			.prepare(
				`CREATE TRIGGER test_fail_later_tag BEFORE INSERT ON player_to_player_tag WHEN NEW.position >= ${Math.floor(D1_MAX_BOUND_PARAMS / 3)} BEGIN SELECT RAISE(ABORT, 'test forced later insert failure'); END;`
			)
			.run();
		const failure = await api.alice.player
			.update({
				id: saved.id,
				name: "Must roll back",
				memo: null,
				tagIds: ids,
			})
			.catch((error: unknown) => error);
		const messages: string[] = [];
		for (
			let cause: unknown = failure;
			cause instanceof Error;
			cause = cause.cause
		) {
			messages.push(cause.message);
		}
		expect(messages.join("\n")).toContain("test forced later insert failure");
		expect(
			await api.db.select().from(player).where(eq(player.id, saved.id))
		).toEqual(beforePlayer);
		expect(await api.db.select().from(playerToPlayerTag)).toEqual(beforeLinks);
		expect(await api.db.select().from(playerTag)).toHaveLength(ids.length + 1);
	});
});
