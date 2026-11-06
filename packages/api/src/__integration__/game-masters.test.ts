import { entry, playSession } from "@sapphire2/db/schema/entry";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import {
	gameLineup,
	gameLineupGroup,
	gameLineupVariant,
} from "@sapphire2/db/schema/game-lineup";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { hand } from "@sapphire2/db/schema/hand";
import { count, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
	type ApiFixture,
	FOREIGN_KEY_FAILED,
	requireCreatedRow,
	test,
} from "./test-fixture";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const UNIQUE_FAILED = "UNIQUE constraint failed";

function rejection(code: string, message?: string) {
	return message === undefined
		? { code }
		: { code, message: expect.stringContaining(message) };
}

async function createDrawMasters(api: ApiFixture) {
	await api.alice.gameGroup.list();
	const group = requireCreatedRow(
		await api.alice.gameGroup.create({
			blind1Label: "SB",
			blind2Label: "BB",
			label: "Draw",
		})
	);
	const variant = requireCreatedRow(
		await api.alice.gameVariant.create({
			groupId: group.id,
			label: "Triple Draw",
			shortLabel: "TD",
		})
	);
	const partner = requireCreatedRow(
		await api.alice.gameVariant.create({
			groupId: group.id,
			label: "Single Draw",
		})
	);
	const mix = requireCreatedRow(
		await api.alice.gameMix.create({
			games: [variant.id, partner.id],
			label: "Draw Mix",
		})
	);
	return { group, mix, partner, variant };
}

async function rowCount(
	api: ApiFixture,
	table: typeof gameGroup | typeof gameVariant | typeof gameMix
) {
	const [row] = await api.db
		.select({ value: count() })
		.from(table)
		.where(eq(table.userId, "alice"));
	return row?.value;
}

describe("game masters (real D1)", () => {
	test("rejects a mix when a newly selected variant is archived during creation", async ({
		api,
	}) => {
		const { variant, partner, mix } = await createDrawMasters(api);
		await api.alice.gameMix.archive({ id: mix.id });
		const raced = api.raceCaller("alice", () =>
			api.alice.gameVariant.archive({ id: variant.id })
		);
		await expect(
			raced.gameMix.create({
				games: [variant.id, partner.id],
				label: "Raced Mix",
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(
			(await api.alice.gameMix.list()).some((row) => row.label === "Raced Mix")
		).toBe(false);
	});

	test("rejects a stale mix update that retains a concurrently removed archived variant", async ({
		api,
	}) => {
		const { group, variant, partner, mix } = await createDrawMasters(api);
		const third = requireCreatedRow(
			await api.alice.gameVariant.create({
				groupId: group.id,
				label: "Custom Draw Variant",
			})
		);
		await api.alice.gameMix.archive({ id: mix.id });
		await api.alice.gameVariant.archive({ id: variant.id });
		const raced = api.raceCaller("alice", () =>
			api.alice.gameMix.update({ games: [partner.id, third.id], id: mix.id })
		);
		await expect(
			raced.gameMix.update({
				games: [variant.id, partner.id],
				id: mix.id,
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		const current = (
			await api.alice.gameMix.list({ includeArchived: true })
		).find((row) => row.id === mix.id);
		expect(current?.games).toEqual([partner.id, third.id]);
	});

	test("concurrent seeding converges on the built-in groups", async ({
		api,
	}) => {
		const raced = api.raceCaller("alice", async () => {
			await api.alice.gameGroup.list();
		});
		const groups = await raced.gameGroup.list();
		expect(groups.map((group) => group.builtinKey).sort()).toEqual([
			"bigbet",
			"limit",
			"stud",
		]);
	});

	test("seeding conflicts with a concurrent custom group create", async ({
		api,
	}) => {
		const raced = api.raceCaller("alice", async () => {
			await api.alice.gameGroup.create({ label: "Custom" });
		});
		await expect(raced.gameGroup.list()).rejects.toMatchObject({
			code: "CONFLICT",
		});
		expect(
			(await api.alice.gameGroup.list()).map((group) => group.label)
		).toEqual(["Custom"]);
	});

	test("stake creation conflicts with a concurrent blind requirement change", async ({
		api,
	}) => {
		const variant = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		if (!variant) {
			throw new Error("Missing builtin variant");
		}
		const room = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const raced = api.raceCaller("alice", async () => {
			await api.alice.gameGroup.update({
				blind3Label: "Straddle",
				blind3Required: true,
				id: variant.groupId,
			});
		});
		await expect(
			raced.ringGame.create({
				name: "Cash",
				roomId: room.id,
				rule: {
					game: { variantId: variant.id },
					stakes: [{ blind1: 1, blind2: 2, gameGroupId: variant.groupId }],
				},
			})
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(await api.alice.ringGame.listByRoom({ roomId: room.id })).toEqual(
			[]
		);
	});

	test("an archived master leaves the default list, stays readable with includeArchived, keeps its name and blind slots, and restores", async ({
		api,
	}) => {
		const { group, variant, partner, mix } = await createDrawMasters(api);

		const archivedMix = await api.alice.gameMix.archive({ id: mix.id });
		await api.alice.gameVariant.archive({ id: variant.id });
		await api.alice.gameVariant.archive({ id: partner.id });
		await api.alice.gameGroup.archive({ id: group.id });

		expect(archivedMix?.archivedAt).toBeInstanceOf(Date);
		expect(
			(await api.alice.gameGroup.list()).map((row) => row.id)
		).not.toContain(group.id);
		expect(
			(await api.alice.gameVariant.list()).map((row) => row.id)
		).not.toContain(variant.id);
		expect((await api.alice.gameMix.list()).map((row) => row.id)).not.toContain(
			mix.id
		);

		expect(
			(await api.alice.gameGroup.list({ includeArchived: true })).find(
				(row) => row.id === group.id
			)
		).toMatchObject({
			blind1Label: "SB",
			blind2Label: "BB",
			blind3Label: null,
			label: "Draw",
		});
		expect(
			(await api.alice.gameVariant.list({ includeArchived: true })).find(
				(row) => row.id === variant.id
			)
		).toMatchObject({
			groupId: group.id,
			label: "Triple Draw",
			shortLabel: "TD",
		});
		expect(
			(await api.alice.gameMix.list({ includeArchived: true })).find(
				(row) => row.id === mix.id
			)
		).toMatchObject({ games: [variant.id, partner.id], label: "Draw Mix" });

		await expect(
			api.alice.gameVariant.restore({ id: variant.id })
		).rejects.toMatchObject(rejection("BAD_REQUEST", "restore it first"));
		await api.alice.gameGroup.restore({ id: group.id });
		await api.alice.gameVariant.restore({ id: variant.id });
		await expect(
			api.alice.gameMix.restore({ id: mix.id })
		).rejects.toMatchObject(rejection("BAD_REQUEST", "restore them first"));
		await api.alice.gameVariant.restore({ id: partner.id });
		const restored = await api.alice.gameMix.restore({ id: mix.id });

		expect(restored).toMatchObject({
			archivedAt: null,
			games: [variant.id, partner.id],
		});
		expect((await api.alice.gameMix.list()).map((row) => row.id)).toContain(
			mix.id
		);
	});

	test("archive refuses to break an active master, and delete refuses every reference with archive guidance", async ({
		api,
	}) => {
		const { group, variant, partner, mix } = await createDrawMasters(api);

		await expect(
			api.alice.gameVariant.archive({ id: variant.id })
		).rejects.toMatchObject(rejection("CONFLICT", "active game mix"));
		await expect(
			api.alice.gameGroup.archive({ id: group.id })
		).rejects.toMatchObject(rejection("CONFLICT", "active game variants"));

		await api.alice.gameMix.archive({ id: mix.id });
		await expect(
			api.alice.gameVariant.delete({ id: variant.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));
		await expect(
			api.alice.gameGroup.delete({ id: group.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));

		await api.db.insert(gameLineup).values({
			gameMixId: mix.id,
			id: "lineup",
			userId: "alice",
		});
		await api.db.insert(gameLineupGroup).values({
			gameGroupId: group.id,
			id: "lineup-group",
			lineupId: "lineup",
			position: 0,
			userId: "alice",
		});
		await api.db.insert(gameLineupVariant).values({
			lineupGroupId: "lineup-group",
			lineupId: "lineup",
			position: 0,
			userId: "alice",
			variantId: partner.id,
		});
		await expect(
			api.alice.gameMix.delete({ id: mix.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));

		await api.db
			.update(gameLineup)
			.set({ gameMixId: null })
			.where(eq(gameLineup.id, "lineup"));
		await api.alice.gameMix.delete({ id: mix.id });
		await expect(
			api.alice.gameVariant.delete({ id: partner.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));

		await api.db.insert(entry).values({
			id: "entry",
			kind: "cash",
			playedOn: "2026-09-05",
			source: "live",
			status: "open",
			updatedAt: NOW,
			userId: "alice",
		});
		await api.db.insert(playSession).values({
			entryId: "entry",
			id: "play",
			kind: "cash",
			localDate: "2026-09-05",
			seq: 1,
			status: "active",
			updatedAt: NOW,
			userId: "alice",
		});
		await api.db.insert(hand).values({
			detail: "count",
			handNo: 1,
			id: "hand",
			playSessionId: "play",
			updatedAt: NOW,
			userId: "alice",
			variantId: variant.id,
		});
		await expect(
			api.alice.gameVariant.delete({ id: variant.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));

		await api.db.delete(hand).where(eq(hand.id, "hand"));
		await api.db
			.delete(gameLineupVariant)
			.where(eq(gameLineupVariant.lineupGroupId, "lineup-group"));
		await api.alice.gameVariant.delete({ id: variant.id });
		await api.alice.gameVariant.delete({ id: partner.id });
		await expect(
			api.alice.gameGroup.delete({ id: group.id })
		).rejects.toMatchObject(rejection("CONFLICT", "archive it instead"));

		await api.db
			.delete(gameLineupGroup)
			.where(eq(gameLineupGroup.id, "lineup-group"));
		await expect(api.alice.gameGroup.delete({ id: group.id })).resolves.toEqual(
			{ success: true }
		);
		expect(
			await api.db.select().from(gameGroup).where(eq(gameGroup.id, group.id))
		).toEqual([]);
	});

	test("labels are unique per table across case, surrounding spaces and archived rows, with restore guidance, while a variant and a mix may share one", async ({
		api,
	}) => {
		const { group, variant } = await createDrawMasters(api);

		await expect(
			api.alice.gameVariant.create({
				groupId: group.id,
				label: " triple DRAW ",
			})
		).rejects.toMatchObject(
			rejection("CONFLICT", "You already have a game variant")
		);
		await expect(
			api.alice.gameGroup.create({ label: "big bet" })
		).rejects.toMatchObject(rejection("CONFLICT", "game group"));

		const solo = requireCreatedRow(
			await api.alice.gameVariant.create({ groupId: group.id, label: "Solo" })
		);
		await api.alice.gameVariant.archive({ id: solo.id });
		await expect(
			api.alice.gameVariant.create({ groupId: group.id, label: "SOLO" })
		).rejects.toMatchObject(rejection("CONFLICT", "restore it instead"));
		await expect(
			api.alice.gameVariant.update({ id: variant.id, label: "solo" })
		).rejects.toMatchObject(rejection("CONFLICT", "restore it instead"));

		await expect(
			api.alice.gameVariant.update({ id: variant.id, label: "TRIPLE DRAW" })
		).resolves.toMatchObject({ label: "TRIPLE DRAW" });
		await expect(
			api.alice.gameMix.create({
				games: [variant.id, (await api.alice.gameVariant.list())[0]?.id ?? ""],
				label: "Triple Draw",
			})
		).resolves.toMatchObject({ label: "Triple Draw" });
		await expect(
			api.bob.gameVariant.create({
				groupId: requireCreatedRow(
					await api.bob.gameGroup.create({ label: "Draw" })
				).id,
				label: "Triple Draw",
			})
		).resolves.toMatchObject({ label: "Triple Draw" });
	});

	test("newly selecting an archived master is BAD_REQUEST while a stored composition can be saved unchanged", async ({
		api,
	}) => {
		const { variant, partner, mix } = await createDrawMasters(api);
		const holdem = (await api.alice.gameVariant.list()).find(
			(row) => row.builtinKey === "nlh"
		);
		const other = requireCreatedRow(
			await api.alice.gameGroup.create({ label: "Other" })
		);
		await api.alice.gameGroup.archive({ id: other.id });

		await expect(
			api.alice.gameVariant.create({ groupId: other.id, label: "Badugi 2" })
		).rejects.toMatchObject(rejection("BAD_REQUEST"));
		await expect(
			api.alice.gameVariant.update({ groupId: other.id, id: variant.id })
		).rejects.toMatchObject(rejection("BAD_REQUEST"));

		await api.alice.gameMix.archive({ id: mix.id });
		await api.alice.gameVariant.archive({ id: partner.id });
		await expect(
			api.alice.gameMix.update({
				games: [variant.id, partner.id],
				id: mix.id,
				label: "Old Draw Mix",
			})
		).resolves.toMatchObject({
			games: [variant.id, partner.id],
			label: "Old Draw Mix",
		});
		await expect(
			api.alice.gameMix.create({
				games: [variant.id, partner.id],
				label: "Fresh",
			})
		).rejects.toMatchObject(rejection("BAD_REQUEST", "restore it first"));

		const active = requireCreatedRow(
			await api.alice.gameMix.create({
				games: [variant.id, holdem?.id ?? ""],
				label: "Active",
			})
		);
		await expect(
			api.alice.gameMix.update({
				games: [variant.id, holdem?.id ?? "", partner.id],
				id: active.id,
			})
		).rejects.toMatchObject(rejection("BAD_REQUEST", "restore it first"));
	});

	test("foreign and missing ids are uniformly FORBIDDEN", async ({ api }) => {
		const { group, variant, mix } = await createDrawMasters(api);
		const calls = [
			() => api.bob.gameGroup.update({ id: group.id, label: "Mine" }),
			() => api.bob.gameGroup.archive({ id: group.id }),
			() => api.bob.gameGroup.restore({ id: group.id }),
			() => api.bob.gameGroup.delete({ id: group.id }),
			() => api.bob.gameVariant.update({ id: variant.id, shortLabel: null }),
			() => api.bob.gameVariant.archive({ id: variant.id }),
			() => api.bob.gameVariant.restore({ id: variant.id }),
			() => api.bob.gameVariant.delete({ id: variant.id }),
			() => api.bob.gameVariant.create({ groupId: group.id, label: "X" }),
			() => api.bob.gameMix.update({ id: mix.id, label: "Mine" }),
			() => api.bob.gameMix.archive({ id: mix.id }),
			() => api.bob.gameMix.restore({ id: mix.id }),
			() => api.bob.gameMix.delete({ id: mix.id }),
			() =>
				api.bob.gameMix.create({
					games: [variant.id, "missing"],
					label: "Stolen",
				}),
			() => api.alice.gameGroup.archive({ id: "missing" }),
			() => api.alice.gameVariant.delete({ id: "missing" }),
			() => api.alice.gameMix.restore({ id: "missing" }),
		];

		for (const call of calls) {
			await expect(call()).rejects.toMatchObject(rejection("FORBIDDEN"));
		}
		expect(
			await api.db.select().from(gameMix).where(eq(gameMix.id, mix.id))
		).toMatchObject([{ archivedAt: null, label: "Draw Mix" }]);
	});

	test("archiving every builtin does not re-seed them", async ({ api }) => {
		const mixes = await api.alice.gameMix.list();
		const variants = await api.alice.gameVariant.list();
		const groups = await api.alice.gameGroup.list();
		const before = {
			groups: await rowCount(api, gameGroup),
			mixes: await rowCount(api, gameMix),
			variants: await rowCount(api, gameVariant),
		};

		for (const row of mixes) {
			await api.alice.gameMix.archive({ id: row.id });
		}
		for (const row of variants) {
			await api.alice.gameVariant.archive({ id: row.id });
		}
		for (const row of groups) {
			await api.alice.gameGroup.archive({ id: row.id });
		}

		expect(await api.alice.gameGroup.list()).toEqual([]);
		expect(await api.alice.gameVariant.list()).toEqual([]);
		expect(await api.alice.gameMix.list()).toEqual([]);
		expect({
			groups: await rowCount(api, gameGroup),
			mixes: await rowCount(api, gameMix),
			variants: await rowCount(api, gameVariant),
		}).toEqual(before);
		expect(
			await api.alice.gameMix.list({ includeArchived: true })
		).toHaveLength(mixes.length);
	});

	test("sending the previous values back, null included, restores the edited row", async ({
		api,
	}) => {
		const { group, variant } = await createDrawMasters(api);

		await api.alice.gameGroup.update({
			blind1Label: null,
			blind3Label: "Straddle",
			id: group.id,
		});
		await api.alice.gameVariant.update({
			id: variant.id,
			shortLabel: null,
		});
		const undoneGroup = await api.alice.gameGroup.update({
			blind1Label: group.blind1Label,
			blind3Label: group.blind3Label,
			id: group.id,
		});
		const undoneVariant = await api.alice.gameVariant.update({
			id: variant.id,
			shortLabel: variant.shortLabel,
		});

		expect({ ...undoneGroup, updatedAt: null }).toEqual({
			...group,
			updatedAt: null,
		});
		expect({ ...undoneVariant, updatedAt: null }).toEqual({
			...variant,
			updatedAt: null,
		});
	});

	test("the database rejects another user's group and normalized duplicate labels, and account deletion still succeeds", async ({
		api,
	}) => {
		const { group } = await createDrawMasters(api);
		const bobGroup = requireCreatedRow(
			await api.bob.gameGroup.create({ label: "Bob Draw" })
		);
		const insertVariant = (id: string, label: string, groupId: string) =>
			api.d1
				.prepare(
					"INSERT INTO game_variant (id, user_id, label, group_id, updated_at) VALUES (?, 'alice', ?, ?, 0)"
				)
				.bind(id, label, groupId)
				.run();

		await expect(insertVariant("cross", "Cross", bobGroup.id)).rejects.toThrow(
			FOREIGN_KEY_FAILED
		);
		await expect(
			insertVariant("spaced", "  triple draw ", group.id)
		).rejects.toThrow(UNIQUE_FAILED);
		await api.d1
			.prepare(
				"UPDATE game_mix SET archived_at = 1 WHERE user_id = 'alice' AND label = 'Draw Mix'"
			)
			.run();
		await expect(
			api.d1
				.prepare(
					"INSERT INTO game_mix (id, user_id, label, updated_at) VALUES ('dup', 'alice', 'DRAW MIX ', 0)"
				)
				.run()
		).rejects.toThrow(UNIQUE_FAILED);
		await expect(
			api.d1
				.prepare(
					"INSERT INTO game_mix (id, user_id, label, updated_at) VALUES ('shared', 'alice', 'Triple Draw', 0)"
				)
				.run()
		).resolves.toBeDefined();

		await api.d1.prepare("DELETE FROM user WHERE id = 'alice'").run();

		expect(await rowCount(api, gameVariant)).toBe(0);
		expect(await rowCount(api, gameGroup)).toBe(0);
		expect(
			await api.db
				.select({ id: gameGroup.id })
				.from(gameGroup)
				.where(eq(gameGroup.userId, "bob"))
		).toEqual([{ id: bobGroup.id }]);
	});
});
