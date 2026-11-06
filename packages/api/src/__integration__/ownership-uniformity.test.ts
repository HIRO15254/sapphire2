import { entryTag } from "@sapphire2/db/schema/entry-tag";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { handTag } from "@sapphire2/db/schema/hand-tag";
import { ledgerCategory } from "@sapphire2/db/schema/ledger";
import { playerTag } from "@sapphire2/db/schema/player";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { cashRule } from "@sapphire2/db/schema/rule";
import { tournament } from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

test("ring game rejects foreign and missing identifiers uniformly without writes", async ({
	api,
}) => {
	const club = requireCreatedRow(await api.bob.room.create({ name: "Club" }));
	const game = await api.bob.ringGame.create({
		name: "Cash",
		roomId: club.id,
		rule: {
			stakes: [
				{ blind1: 1, blind2: 2, gameGroupId: "bob:builtin-group:bigbet" },
			],
		},
	});
	const before = {
		games: await api.db.select().from(ringGame),
		rules: await api.db.select().from(cashRule),
	};
	const calls = [
		(id: string) =>
			api.alice.ringGame.create({ name: "Cash", roomId: id, rule: {} }),
		(id: string) => api.alice.ringGame.listByRoom({ roomId: id }),
		(id: string) => api.alice.ringGame.update({ id, name: "Changed" }),
		(id: string) => api.alice.ringGame.archive({ id }),
		(id: string) => api.alice.ringGame.restore({ id }),
	];
	for (const [index, call] of calls.entries()) {
		const errors: ({ code: string; message: string } | null)[] = [];
		for (const id of [index < 2 ? club.id : game.id, "missing"]) {
			errors.push(
				// biome-ignore lint/performance/noAwaitInLoops: Keep D1 requests sequential.
				await call(id).then(
					() => null,
					(error: { code: string; message: string }) => ({
						code: error.code,
						message: error.message,
					})
				)
			);
		}
		expect(errors[0]).toMatchObject({ code: "FORBIDDEN" });
		expect(errors[1]).toEqual(errors[0]);
	}
	expect({
		games: await api.db.select().from(ringGame),
		rules: await api.db.select().from(cashRule),
	}).toEqual(before);
});

const cases = [
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.playerTag.update({ id, name: "Renamed" }),
				() => caller.playerTag.delete({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.playerTag.create({ name: "Tag" }),
		router: "playerTag",
		table: playerTag,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.entryTag.update({ id, name: "Renamed" }),
				() => caller.entryTag.delete({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.entryTag.create({ name: "Tag" }),
		router: "entryTag",
		table: entryTag,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.tournamentTag.update({ id, name: "Renamed" }),
				() => caller.tournamentTag.delete({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.tournamentTag.create({ name: "Tag" }),
		router: "tournamentTag",
		table: tournamentTag,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.handTag.update({ id, name: "Renamed" }),
				() => caller.handTag.delete({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.handTag.create({ name: "Tag" }),
		router: "handTag",
		table: handTag,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.ledgerCategory.update({ id, name: "Renamed" }),
				() => caller.ledgerCategory.archive({ id }),
				() => caller.ledgerCategory.restore({ id }),
				() => caller.ledgerCategory.delete({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.ledgerCategory.create({ name: "Deposit" }),
		router: "ledgerCategory",
		table: ledgerCategory,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.room.update({ id, name: "Renamed" }),
				() => caller.room.getById({ id }),
				() => caller.room.toggleFavorite({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.room.create({ name: "Room" }),
		router: "room",
		table: room,
	},
	{
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.filterPreset.update({ id, name: "Renamed" }),
				() => caller.filterPreset.delete({ id }),
				() => caller.filterPreset.setDefault({ id }),
				() => caller.filterPreset.clearDefault({ id }),
			] as const,
		create: (caller: ApiFixture["alice"]) =>
			caller.filterPreset.create({
				name: "Preset",
				payload: {},
				screenKey: "sessions",
			}),
		router: "filterPreset",
		table: filterPreset,
	},
] as const;

test.for(cases)(
	"$router prevents foreign access and existence disclosure without blocking its owner",
	async ({ table, create, calls }, { api }) => {
		const foreign = requireCreatedRow(await create(api.bob));
		const own = requireCreatedRow(await create(api.alice));
		const before = await api.db.select().from(table);
		const foreignCalls = calls(api.alice, foreign.id);
		const missingCalls = calls(api.alice, "missing");
		for (const [index, foreignCall] of foreignCalls.entries()) {
			const missingCall = missingCalls[index];
			if (!missingCall) {
				throw new Error("Missing ownership test call");
			}
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 test cases sequential.
			const errors = await Promise.all(
				[foreignCall, missingCall].map((call) =>
					call().then(
						() => null,
						(error: unknown) => error
					)
				)
			);
			expect(errors[0]).toMatchObject({ code: "FORBIDDEN" });
			expect(errors[1]).toMatchObject({
				code: "FORBIDDEN",
				message: (errors[0] as Error).message,
			});
			expect(await api.db.select().from(table)).toEqual(before);
		}
		const [updateOwn] = calls(api.alice, own.id);
		await expect(updateOwn()).resolves.toMatchObject({
			id: own.id,
			name: "Renamed",
		});
		expect(
			await api.db.select().from(table).where(eq(table.id, own.id))
		).toEqual([
			expect.objectContaining({ id: own.id, name: "Renamed", userId: "alice" }),
		]);
		expect(
			await api.db.select().from(table).where(eq(table.id, foreign.id))
		).toEqual([expect.objectContaining({ id: foreign.id, userId: "bob" })]);
	}
);

test("tournament procedures reject foreign and missing rooms and masters uniformly", async ({
	api,
}) => {
	const bobRoom = requireCreatedRow(await api.bob.room.create({ name: "Bob" }));
	const bobTournament = await api.bob.tournament.create({
		name: "Bob tournament",
		roomId: bobRoom.id,
		rule: {},
	});
	const before = await api.db.select().from(tournament);
	for (const [foreignId, calls] of [
		[
			bobRoom.id,
			[
				(id: string) => api.alice.tournament.listByRoom({ roomId: id }),
				(id: string) =>
					api.alice.tournament.create({ name: "Test", roomId: id, rule: {} }),
				(id: string) =>
					api.alice.tournament.createWithLevels({
						name: "Test",
						roomId: id,
						rule: { levels: [] },
					}),
			],
		],
		[
			bobTournament.id,
			[
				(id: string) => api.alice.tournament.getById({ id }),
				(id: string) => api.alice.tournament.update({ id, name: "Changed" }),
				(id: string) =>
					api.alice.tournament.updateWithLevels({ id, rule: { levels: [] } }),
				(id: string) => api.alice.tournament.archive({ id }),
				(id: string) => api.alice.tournament.restore({ id }),
			],
		],
	] as const) {
		for (const call of calls) {
			// biome-ignore lint/performance/noAwaitInLoops: Keep D1 test cases sequential.
			const errors = await Promise.all(
				[foreignId, "missing"].map((id) =>
					call(id).then(
						() => null,
						(error: unknown) => error
					)
				)
			);
			expect(errors[0]).toMatchObject({ code: "FORBIDDEN" });
			expect(errors[1]).toMatchObject({
				code: "FORBIDDEN",
				message: (errors[0] as Error).message,
			});
		}
	}
	expect(await api.db.select().from(tournament)).toEqual(before);
});
