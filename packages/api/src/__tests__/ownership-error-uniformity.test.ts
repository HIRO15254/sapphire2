import type { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { createChainableMockDb } from "./test-utils";

const OWNER = "user-1";
const OTHER = "user-2";

async function expectForbidden(promise: Promise<unknown>): Promise<void> {
	await expect(promise).rejects.toMatchObject({
		code: "FORBIDDEN" satisfies TRPCError["code"],
	});
}

function makeCaller(select: Record<string, Record<string, unknown>[]>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: OWNER } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]);
	return { caller, ...mock };
}

describe("ownership failures hide resource existence", () => {
	it.each([
		[
			"playerTag.update",
			"player_tag",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.playerTag.update({ id: "tag-1", name: "Renamed" }),
		],
		[
			"playerTag.delete",
			"player_tag",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.playerTag.delete({ id: "tag-1" }),
		],
		[
			"sessionTag.update",
			"session_tag",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.sessionTag.update({ id: "tag-1", name: "Renamed" }),
		],
		[
			"sessionTag.delete",
			"session_tag",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.sessionTag.delete({ id: "tag-1" }),
		],
		[
			"transactionType.update",
			"transaction_type",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.transactionType.update({ id: "type-1", name: "Renamed" }),
		],
		[
			"transactionType.delete",
			"transaction_type",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.transactionType.delete({ id: "type-1" }),
		],
		[
			"room.getById",
			"room",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.room.getById({ id: "room-1" }),
		],
		[
			"room.update",
			"room",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.room.update({ id: "room-1", name: "Renamed" }),
		],
		[
			"room.delete",
			"room",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.room.delete({ id: "room-1" }),
		],
		[
			"room.toggleFavorite",
			"room",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.room.toggleFavorite({ id: "room-1" }),
		],
		[
			"player.getById",
			"player",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.player.getById({ id: "player-1" }),
		],
		[
			"player.update",
			"player",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.player.update({ id: "player-1", name: "Renamed" }),
		],
		[
			"player.delete",
			"player",
			(caller: ReturnType<typeof makeCaller>["caller"]) =>
				caller.player.delete({ id: "player-1" }),
		],
	] as const)("%s returns FORBIDDEN for missing and foreign rows", async (_name, table, call) => {
		await expectForbidden(call(makeCaller({}).caller));
		await expectForbidden(
			call(
				makeCaller({ [table]: [{ id: "resource-1", userId: OTHER }] }).caller
			)
		);
	});
});

describe("player tag ownership boundaries", () => {
	it("returns FORBIDDEN for missing or foreign list filter tags", async () => {
		for (const id of ["missing-tag", "foreign-tag"]) {
			const { caller, selectWhereParams } = makeCaller({ player_tag: [] });
			await expectForbidden(caller.player.list({ tagIds: [id] }));
			expect(selectWhereParams).toContainEqual(
				expect.arrayContaining([id, OWNER])
			);
		}
	});

	it("returns FORBIDDEN for missing or foreign create tags before writing", async () => {
		for (const id of ["missing-tag", "foreign-tag"]) {
			const { caller, inserted, selectWhereParams } = makeCaller({
				player_tag: [],
			});
			await expectForbidden(
				caller.player.create({ name: "Player", tagIds: [id] })
			);
			expect(inserted.player).toBeUndefined();
			expect(selectWhereParams).toContainEqual(
				expect.arrayContaining([id, OWNER])
			);
		}
	});

	it("returns FORBIDDEN for missing or foreign replacement tags before writing", async () => {
		for (const id of ["missing-tag", "foreign-tag"]) {
			const { caller, inserted, updateWhereParams, selectWhereParams } =
				makeCaller({
					player: [{ id: "player-1", userId: OWNER }],
					player_tag: [],
				});
			await expectForbidden(
				caller.player.update({ id: "player-1", tagIds: [id] })
			);
			expect(inserted.player_to_player_tag).toBeUndefined();
			expect(updateWhereParams).toHaveLength(0);
			expect(selectWhereParams).toContainEqual(
				expect.arrayContaining([id, OWNER])
			);
		}
	});
});
