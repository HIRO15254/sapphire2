import { tournament } from "@sapphire2/db/schema/tournament";
import { tournamentTagLink } from "@sapphire2/db/schema/tournament-tag";
import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { MAX_LINKED_TAGS } from "../lib/tag-ids";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

async function setup(api: ApiFixture) {
	const room = requireCreatedRow(await api.alice.room.create({ name: "Club" }));
	const tags: { id: string; name: string }[] = [];
	for (const name of ["First", "Second", "Third"]) {
		tags.push(
			requireCreatedRow(await api.alice.tournamentTag.create({ name }))
		);
	}
	return { room, tags };
}

function tagIdsOf(output: { tags: { id: string }[] }) {
	return output.tags.map(({ id }) => id);
}

describe("tournament tagIds on D1", () => {
	test("supplied tagIds replace the links, omitted keeps them and [] clears them", async ({
		api,
	}) => {
		const { room, tags } = await setup(api);
		const [first, second, third] = tags.map(({ id }) => id) as [
			string,
			string,
			string,
		];
		const created = await api.alice.tournament.create({
			roomId: room.id,
			name: "Daily",
			rule: {},
			tagIds: [third, first],
		});
		expect(created.tags).toEqual([
			{ id: first, name: "First" },
			{ id: third, name: "Third" },
		]);

		const renamed = await api.alice.tournament.update({
			id: created.id,
			name: "Daily renamed",
		});
		expect(tagIdsOf(renamed)).toEqual([first, third]);

		const replaced = await api.alice.tournament.update({
			id: created.id,
			tagIds: [second],
		});
		expect(tagIdsOf(replaced)).toEqual([second]);

		const cleared = await api.alice.tournament.update({
			id: created.id,
			tagIds: [],
		});
		expect(cleared.tags).toEqual([]);
		expect(
			await api.db
				.select()
				.from(tournamentTagLink)
				.where(eq(tournamentTagLink.tournamentId, created.id))
		).toEqual([]);
	});

	test("foreign and missing tag ids are FORBIDDEN on create and update without any write", async ({
		api,
	}) => {
		const { room, tags } = await setup(api);
		const own = tags[0]?.id as string;
		const foreign = requireCreatedRow(
			await api.bob.tournamentTag.create({ name: "Private" })
		);
		const saved = await api.alice.tournament.create({
			roomId: room.id,
			name: "Daily",
			rule: {},
			tagIds: [own],
		});
		const tournamentsBefore = await api.db.select().from(tournament);
		const linksBefore = await api.db.select().from(tournamentTagLink);
		for (const id of [foreign.id, "missing-tag"]) {
			await expect(
				api.alice.tournament.create({
					roomId: room.id,
					name: "Rejected",
					rule: {},
					tagIds: [own, id],
				})
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own one or more of these tags",
			});
			await expect(
				api.alice.tournament.update({
					id: saved.id,
					name: "Rejected",
					tagIds: [id],
				})
			).rejects.toMatchObject({
				code: "FORBIDDEN",
				message: "You do not own one or more of these tags",
			});
		}
		expect(await api.db.select().from(tournament)).toEqual(tournamentsBefore);
		expect(await api.db.select().from(tournamentTagLink)).toEqual(linksBefore);
	});

	test("the database rejects a link to another user's tag, so its name never reaches the owner", async ({
		api,
	}) => {
		const { room } = await setup(api);
		const foreign = requireCreatedRow(
			await api.bob.tournamentTag.create({ name: "Secret" })
		);
		const saved = await api.alice.tournament.create({
			roomId: room.id,
			name: "Daily",
			rule: {},
		});
		for (const userId of ["alice", "bob"]) {
			await expect(
				api.db
					.insert(tournamentTagLink)
					.values({ userId, tournamentId: saved.id, tagId: foreign.id })
			).rejects.toThrow();
		}
		expect((await api.alice.tournament.getById({ id: saved.id })).tags).toEqual(
			[]
		);
	});

	test("a replacement spanning several insert chunks rolls back the tournament and every link when a later chunk fails", async ({
		api,
	}) => {
		const { room, tags } = await setup(api);
		const saved = await api.alice.tournament.create({
			roomId: room.id,
			name: "Original",
			rule: {},
			tagIds: [tags[0]?.id as string],
		});
		const ids: string[] = [];
		for (let index = 0; index < MAX_LINKED_TAGS; index++) {
			ids.push(
				requireCreatedRow(
					await api.alice.tournamentTag.create({ name: `Bulk ${index}` })
				).id
			);
		}
		const tournamentBefore = await api.db
			.select()
			.from(tournament)
			.where(eq(tournament.id, saved.id));
		const linksBefore = await api.db.select().from(tournamentTagLink);
		await api.d1
			.prepare(
				`CREATE TRIGGER test_fail_later_tournament_tag BEFORE INSERT ON tournament_tag_link WHEN NEW.tag_id = '${ids.at(-1)}' BEGIN SELECT RAISE(ABORT, 'test forced later insert failure'); END;`
			)
			.run();

		await expect(
			api.alice.tournament.update({
				id: saved.id,
				name: "Must roll back",
				tagIds: ids,
			})
		).rejects.toThrow();

		expect(
			await api.db.select().from(tournament).where(eq(tournament.id, saved.id))
		).toEqual(tournamentBefore);
		expect(await api.db.select().from(tournamentTagLink)).toEqual(linksBefore);
	});
});
