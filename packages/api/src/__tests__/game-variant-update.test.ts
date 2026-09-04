import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	withGameMixVariantFixtures,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);

function gameVariantCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({
		select: withGameMixVariantFixtures(select),
	});
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameVariant;
	return { caller, ...mock };
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		return;
	}
	throw new Error(`expected the call to throw ${code} but it resolved`);
}

const CUR_OWNER = "user-1";
const OWNED_GROUP = { id: "grp-1", userId: CUR_OWNER, label: "Big Bet" };
const OWNED_TARGET_GROUP = {
	id: "grp-2",
	userId: CUR_OWNER,
	label: "Stud",
};

describe("gameVariant.update field pass-through", () => {
	it("writes shortLabel, groupId, and sortOrder for a row owned by the caller", async () => {
		const { caller, updated } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP, OWNED_TARGET_GROUP],
			[VARIANT_TABLE]: [
				{
					id: "gv-1",
					userId: CUR_OWNER,
					label: "My Mix",
					groupId: "grp-1",
					sortOrder: 0,
				},
			],
		});

		await caller.update({
			id: "gv-1",
			shortLabel: "NLH",
			groupId: "grp-2",
			sortOrder: 3,
		});

		expect(updated[VARIANT_TABLE]?.[0]).toMatchObject({
			shortLabel: "NLH",
			groupId: "grp-2",
			sortOrder: 3,
		});
	});
});

describe("gameVariant.update collision guard (CONFLICT via UNIQUE constraint)", () => {
	it("converts a UNIQUE constraint violation from the update into CONFLICT", async () => {
		const { caller, db } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
		});
		db.update = () => ({
			set: () => ({
				where: () => {
					throw new Error(
						"UNIQUE constraint failed: game_variant.user_id, game_variant.label"
					);
				},
			}),
		});

		await expectTrpcCode(caller.update({ id: "gv-1", label: "X" }), "CONFLICT");
	});
});
