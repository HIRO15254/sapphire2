import { transactionType } from "@sapphire2/db/schema/currency";
import { filterPreset } from "@sapphire2/db/schema/filter-preset";
import { playerTag } from "@sapphire2/db/schema/player";
import { room } from "@sapphire2/db/schema/room";
import { sessionTag } from "@sapphire2/db/schema/session-tag";
import { eq } from "drizzle-orm";
import { expect } from "vitest";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

const cases = [
	{
		router: "playerTag",
		table: playerTag,
		message: "You do not own this tag",
		create: (caller: ApiFixture["alice"]) =>
			caller.playerTag.create({ name: "Tag" }),
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.playerTag.update({ id, name: "Renamed" }),
				() => caller.playerTag.delete({ id }),
			] as const,
	},
	{
		router: "sessionTag",
		table: sessionTag,
		message: "You do not own this tag",
		create: (caller: ApiFixture["alice"]) =>
			caller.sessionTag.create({ name: "Tag" }),
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.sessionTag.update({ id, name: "Renamed" }),
				() => caller.sessionTag.delete({ id }),
			] as const,
	},
	{
		router: "transactionType",
		table: transactionType,
		message: "You do not own this transaction type",
		create: (caller: ApiFixture["alice"]) =>
			caller.transactionType.create({ name: "Transfer" }),
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.transactionType.update({ id, name: "Renamed" }),
				() => caller.transactionType.delete({ id }),
			] as const,
	},
	{
		router: "room",
		table: room,
		message: "You do not own this room",
		create: (caller: ApiFixture["alice"]) =>
			caller.room.create({ name: "Room" }),
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.room.update({ id, name: "Renamed" }),
				() => caller.room.getById({ id }),
				() => caller.room.toggleFavorite({ id }),
			] as const,
	},
	{
		router: "filterPreset",
		table: filterPreset,
		message: "You do not own this filter preset",
		create: (caller: ApiFixture["alice"]) =>
			caller.filterPreset.create({
				screenKey: "sessions",
				name: "Preset",
				payload: {},
			}),
		calls: (caller: ApiFixture["alice"], id: string) =>
			[
				() => caller.filterPreset.update({ id, name: "Renamed" }),
				() => caller.filterPreset.delete({ id }),
				() => caller.filterPreset.setDefault({ id }),
				() => caller.filterPreset.clearDefault({ id }),
			] as const,
	},
] as const;

test.for(
	cases
)("$router prevents foreign access and existence disclosure without blocking its owner", async ({
	table,
	message,
	create,
	calls,
}, { api }) => {
	const foreign = requireCreatedRow(await create(api.bob));
	const own = requireCreatedRow(await create(api.alice));
	const before = await api.db.select().from(table);
	for (const id of [foreign.id, "missing"]) {
		for (const call of calls(api.alice, id)) {
			await expect(call()).rejects.toMatchObject({
				code: "FORBIDDEN",
				message,
			});
			expect(await api.db.select().from(table)).toEqual(before);
		}
	}
	const [updateOwn] = calls(api.alice, own.id);
	await expect(updateOwn()).resolves.toMatchObject({
		id: own.id,
		name: "Renamed",
	});
	expect(await api.db.select().from(table).where(eq(table.id, own.id))).toEqual(
		[expect.objectContaining({ id: own.id, userId: "alice", name: "Renamed" })]
	);
	expect(
		await api.db.select().from(table).where(eq(table.id, foreign.id))
	).toEqual([foreign]);
});
