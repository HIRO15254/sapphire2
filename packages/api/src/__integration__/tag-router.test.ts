import { describe, expect } from "vitest";
import { MAX_TAGS_PER_KIND } from "../routers/tag-router";
import {
	type ApiFixture,
	AUTH_QUERY_RESERVE,
	D1_QUERIES_PER_INVOCATION,
	requireCreatedRow,
	test,
} from "./test-fixture";

type Caller = ApiFixture["alice"];

const kinds = [
	{ kind: "entryTag", table: "entry_tag" },
	{ kind: "tournamentTag", table: "tournament_tag" },
	{ kind: "handTag", table: "hand_tag" },
	{ kind: "playerTag", table: "player_tag" },
] as const;

type Kind = (typeof kinds)[number]["kind"];

function tags(caller: Caller, kind: Kind) {
	return caller[kind];
}

async function seedTags(
	api: ApiFixture,
	table: string,
	userId: string,
	count: number
) {
	await api.d1
		.prepare(
			`WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i + 1 < ?) INSERT INTO ${table} (id, user_id, name, sort_order, updated_at) SELECT ? || '-' || i, ?, 'Tag ' || i, i, 0 FROM n`
		)
		.bind(count, `${userId}-${table}`, userId)
		.run();
	return Array.from(
		{ length: count },
		(_, index) => `${userId}-${table}-${index}`
	);
}

describe.for(kinds)("$kind on D1", ({ kind, table }) => {
	test("create, rename, reorder and delete read back in position order", async ({
		api,
	}) => {
		const router = tags(api.alice, kind);
		const first = requireCreatedRow(await router.create({ name: " First " }));
		const second = requireCreatedRow(await router.create({ name: "Second" }));
		const third = requireCreatedRow(await router.create({ name: "Third" }));
		expect(first).toMatchObject({ name: "First", position: 0 });
		expect(
			(await router.list()).map(({ id, position }) => [id, position])
		).toEqual([
			[first.id, 0],
			[second.id, 1],
			[third.id, 2],
		]);

		expect(
			await router.update({ id: second.id, name: "Renamed" })
		).toMatchObject({ id: second.id, name: "Renamed", position: 1 });

		const reordered = await router.reorder({
			ids: [third.id, first.id, second.id],
		});
		expect(
			reordered.map(({ id, name, position }) => [id, name, position])
		).toEqual([
			[third.id, "Third", 0],
			[first.id, "First", 1],
			[second.id, "Renamed", 2],
		]);
		expect(await router.list()).toEqual(reordered);

		await expect(router.delete({ id: first.id })).resolves.toEqual({
			success: true,
		});
		expect((await router.list()).map(({ id }) => id)).toEqual([
			third.id,
			second.id,
		]);
	});

	test("names are unique per user after trimming and case folding, never across users", async ({
		api,
	}) => {
		const alice = tags(api.alice, kind);
		await alice.create({ name: "Regular" });
		await expect(alice.create({ name: "  regular " })).rejects.toMatchObject({
			code: "CONFLICT",
		});
		const other = requireCreatedRow(await alice.create({ name: "Other" }));
		await expect(
			alice.update({ id: other.id, name: "REGULAR" })
		).rejects.toMatchObject({ code: "CONFLICT" });
		requireCreatedRow(await tags(api.bob, kind).create({ name: "regular" }));
		expect((await alice.list()).map(({ name }) => name)).toEqual([
			"Regular",
			"Other",
		]);
		expect((await tags(api.bob, kind).list()).map(({ name }) => name)).toEqual([
			"regular",
		]);
	});

	test("reorder rejects foreign, missing, repeated and partial ids without moving any tag", async ({
		api,
	}) => {
		const alice = tags(api.alice, kind);
		const first = requireCreatedRow(await alice.create({ name: "First" }));
		const second = requireCreatedRow(await alice.create({ name: "Second" }));
		const foreign = requireCreatedRow(
			await tags(api.bob, kind).create({ name: "Private" })
		);
		const before = await alice.list();
		for (const id of [foreign.id, "missing"]) {
			await expect(
				alice.reorder({ ids: [second.id, first.id, id] })
			).rejects.toMatchObject({
				code: "FORBIDDEN",
			});
		}
		await expect(
			alice.reorder({ ids: [second.id, second.id] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(alice.reorder({ ids: [second.id] })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(await alice.list()).toEqual(before);
		expect(await tags(api.bob, kind).list()).toEqual([foreign]);
	});

	test.for(["create", "delete"] as const)(
		"reorder conflicts if a tag is changed by %s before its write",
		async (operation, { api }) => {
			const alice = tags(api.alice, kind);
			const first = requireCreatedRow(await alice.create({ name: "First" }));
			const second = requireCreatedRow(await alice.create({ name: "Second" }));
			const raced = tags(
				api.raceCaller("alice", () =>
					operation === "create"
						? alice.create({ name: "Third" })
						: alice.delete({ id: first.id })
				),
				kind
			);
			await expect(
				raced.reorder({ ids: [second.id, first.id] })
			).rejects.toMatchObject({ code: "CONFLICT" });
			const remaining = await alice.list();
			expect(remaining.find((tag) => tag.id === second.id)?.position).toBe(1);
			expect(remaining.map((tag) => tag.name)).toEqual(
				operation === "create" ? ["First", "Second", "Third"] : ["Second"]
			);
		}
	);

	test("a reorder of the maximum tag count stays inside the D1 query budget and the cap blocks one more", async ({
		api,
	}) => {
		const ids = await seedTags(api, table, "alice", MAX_TAGS_PER_KIND);
		await expect(
			tags(api.alice, kind).create({ name: "One too many" })
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

		const { caller, meter } = api.meteredCaller("alice");
		const reordered = await tags(caller, kind).reorder({
			ids: ids.toReversed(),
		});
		expect(reordered.map(({ id }) => id)).toEqual(ids.toReversed());
		expect(reordered.at(-1)?.position).toBe(MAX_TAGS_PER_KIND - 1);
		expect(meter.statements).toBeLessThanOrEqual(
			D1_QUERIES_PER_INVOCATION - AUTH_QUERY_RESERVE
		);
	});
});
