import { player, playerTag, playerTagLink } from "@sapphire2/db/schema/player";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";
import { requireCreatedRow, test } from "./test-fixture";

describe("player tags and atomic writes on D1", () => {
	test("searches long names and treats wildcard characters literally", async ({
		api,
	}) => {
		const name = "a".repeat(60);
		const saved = requireCreatedRow(await api.alice.player.create({ name }));
		await api.alice.player.create({ name: "abc" });
		expect(
			(await api.alice.player.list({ search: name })).map(({ id }) => id)
		).toEqual([saved.id]);
		expect(await api.alice.player.list({ search: "a_c" })).toEqual([]);
	});

	test("hides self and temporary players in every list path without hiding opponents named Hero", async ({
		api,
	}) => {
		const self = await api.alice.player.getSelf();
		const tag = requireCreatedRow(
			await api.alice.playerTag.create({ name: "Regular" })
		);
		await api.alice.player.update({ id: self.id, tagIds: [tag.id] });
		const opponent = requireCreatedRow(
			await api.alice.player.create({ name: "Hero opponent", tagIds: [tag.id] })
		);
		await api.db.insert(player).values({
			id: "temporary",
			isTemporary: true,
			name: "Hero temporary",
			updatedAt: new Date(),
			userId: "alice",
		});
		for (const input of [undefined, { search: "Hero" }, { tagIds: [tag.id] }]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 requests sequential.
			expect((await api.alice.player.list(input)).map(({ id }) => id)).toEqual([
				opponent.id,
			]);
		}
	});

	test("concurrent self requests create one persistent identity and enforce ownership and deletion", async ({
		api,
	}) => {
		const [self, ...rest] = await Promise.all([
			api.alice.player.getSelf(),
			api.alice.player.getSelf(),
			api.alice.player.getSelf(),
			api.alice.player.getSelf(),
			api.alice.player.getSelf(),
		]);
		expect(self).toMatchObject({
			isSelf: true,
			isTemporary: false,
			name: "Hero",
			tags: [],
		});
		expect(rest.map(({ id }) => id)).toEqual(new Array(4).fill(self.id));
		expect(await api.alice.player.getSelf()).toEqual(self);
		expect(
			await api.db.select().from(player).where(eq(player.userId, "alice"))
		).toHaveLength(1);
		await expect(
			api.alice.player.delete({ id: self.id })
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await api.alice.player.getById({ id: self.id })).toEqual(self);
		const foreign = await api.bob.player.getSelf();
		await expect(
			api.alice.player.getById({ id: foreign.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.player.update({ id: foreign.id, name: "No" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			api.alice.player.delete({ id: foreign.id })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	test("database enforces one boolean self identity per user", async ({
		api,
	}) => {
		await api.alice.player.getSelf();
		const insert = (id: string, userId: string, isSelf: number) =>
			api.d1
				.prepare(
					"INSERT INTO player (id, user_id, name, is_self, updated_at) VALUES (?, ?, ?, ?, 0)"
				)
				.bind(id, userId, "Hero", isSelf)
				.run();
		await expect(insert("duplicate-self", "alice", 1)).rejects.toThrow();
		await expect(insert("invalid-self", "alice", 2)).rejects.toThrow();
		await expect(insert("bob-self", "bob", 1)).resolves.toBeDefined();
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
		const linksBefore = await api.db.select().from(playerTagLink);
		const errorsFor = async (id: string) => {
			const errors: unknown[] = [];
			for (const call of [
				() => api.alice.player.getById({ id }),
				() => api.alice.player.update({ id, name: "Rejected", tagIds: [] }),
				() => api.alice.player.delete({ id }),
			]) {
				errors.push(
					// biome-ignore lint/performance/noAwaitInLoops: Keep D1 requests sequential.
					await call().then(
						() => null,
						(error: unknown) => error
					)
				);
			}
			return errors;
		};
		const missingErrors = await errorsFor("missing-player");
		const savedErrors = await errorsFor(saved.id);
		for (const [index, error] of savedErrors.entries()) {
			expect(error).toMatchObject({ code: "FORBIDDEN" });
			expect(missingErrors[index]).toMatchObject({
				code: "FORBIDDEN",
				message: (error as Error).message,
			});
		}
		expect(await api.db.select().from(player)).toEqual(playersBefore);
		expect(await api.db.select().from(playerTagLink)).toEqual(linksBefore);
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
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 inserts sequential.
			await api.db.insert(player).values({
				id,
				name: `Match ${id}`,
				updatedAt: new Date("2026-09-05"),
				userId: "alice",
			});
			await api.db.insert(playerTagLink).values([
				{ playerId: id, position: 0, tagId: tag.id, userId: "alice" },
				{ playerId: id, position: 1, tagId: secondTag.id, userId: "alice" },
			]);
		}
		await api.bob.player.create({ name: "Match private" });
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
				color: "red",
				name: "Aggressive",
			})
		);
		const regular = requireCreatedRow(
			await api.alice.playerTag.create({
				color: "blue",
				name: "Regular",
			})
		);
		const created = requireCreatedRow(
			await api.alice.player.create({
				memo: "Initial read",
				name: "Alex",
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
			memo: "Initial read",
			name: "Alex",
			tags: [{ id: regular.id }, { id: aggressive.id }],
		});
		expect(
			(
				await api.alice.player.list({ search: "Alex", tagIds: [regular.id] })
			).map(({ id }) => id)
		).toEqual([created.id]);
		await api.alice.player.update({
			id: created.id,
			memo: null,
			name: "Alex updated",
			tagIds: [],
		});
		expect(await api.alice.player.getById({ id: created.id })).toMatchObject({
			memo: null,
			name: "Alex updated",
			tags: [],
		});
		expect(await api.alice.player.getById({ id: other.id })).toMatchObject({
			tags: [{ id: regular.id }],
		});
		await api.alice.player.delete({ id: other.id });
		expect(
			await api.db
				.select()
				.from(playerTagLink)
				.where(eq(playerTagLink.playerId, other.id))
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
		const beforeLinks = await api.db.select().from(playerTagLink);
		for (const id of [foreign.id, "missing-tag"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 operations sequential.
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
		expect(await api.db.select().from(playerTagLink)).toEqual(beforeLinks);
	});

	test("rejects a link to another user's tag in the database, so foreign tag names never reach list or detail", async ({
		api,
	}) => {
		const ownTag = requireCreatedRow(
			await api.alice.playerTag.create({
				color: "green",
				name: "Visible",
			})
		);
		const privateTag = requireCreatedRow(
			await api.bob.playerTag.create({
				color: "red",
				name: "Secret scouting",
			})
		);
		const saved = requireCreatedRow(
			await api.alice.player.create({
				name: "Public to Alice",
				tagIds: [ownTag.id],
			})
		);

		for (const userId of ["alice", "bob"]) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 constraint checks sequential.
			await expect(
				api.db.insert(playerTagLink).values({
					playerId: saved.id,
					position: 1,
					tagId: privateTag.id,
					userId,
				})
			).rejects.toThrow();
		}
		const expectedTags = [{ color: "green", id: ownTag.id, name: "Visible" }];
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
		const tagCount = Math.floor(D1_MAX_BOUND_PARAMS / 4) + 1;
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
				.from(playerTagLink)
				.where(eq(playerTagLink.playerId, saved.id))
				.orderBy(asc(playerTagLink.position))
		).toEqual(
			ids.toReversed().map((tagId, position) => ({
				playerId: saved.id,
				position,
				tagId,
				userId: "alice",
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
				memo: "Keep me",
				name: "Original name",
				tagIds: [originalTag.id],
			})
		);
		const ids = await api.createPlayerTags(
			"alice",
			Math.floor(D1_MAX_BOUND_PARAMS / 4) + 1
		);
		const beforePlayer = await api.db
			.select()
			.from(player)
			.where(eq(player.id, saved.id));
		const beforeLinks = await api.db.select().from(playerTagLink);

		await api.d1
			.prepare(
				`CREATE TRIGGER test_fail_later_tag BEFORE INSERT ON player_tag_link WHEN NEW.position >= ${Math.floor(D1_MAX_BOUND_PARAMS / 4)} BEGIN SELECT RAISE(ABORT, 'test forced later insert failure'); END;`
			)
			.run();
		const failure = await api.alice.player
			.update({
				id: saved.id,
				memo: null,
				name: "Must roll back",
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
		expect(await api.db.select().from(playerTagLink)).toEqual(beforeLinks);
		expect(await api.db.select().from(playerTag)).toHaveLength(ids.length + 1);
	});
});
