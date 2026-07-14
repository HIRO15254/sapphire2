import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);

function gameVariantCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
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
const CUR_OTHER = "user-2";
const OWNED_GROUP = { id: "grp-1", userId: CUR_OWNER, label: "Big Bet" };
const OTHER_GROUP = { id: "grp-2", userId: CUR_OTHER, label: "Their Group" };

/** Non-empty group/variant rows so list()'s self-seed guard is skipped. */
function seededRows(extra: { variant?: Rows; group?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [OWNED_GROUP],
		[VARIANT_TABLE]: extra.variant ?? [{ id: "v-1", userId: CUR_OWNER }],
	};
}

describe("gameVariant router", () => {
	it("appRouter has gameVariant namespace", () => {
		expect(appRouter.gameVariant).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameVariant).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.gameVariant.list);
		expectType(appRouter.gameVariant.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.gameVariant.create,
			appRouter.gameVariant.update,
			appRouter.gameVariant.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("gameVariant.create input validation", () => {
	it("accepts a minimal valid payload", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
		});
	});

	it("rejects missing groupId", () => {
		expectRejects(appRouter.gameVariant.create, { label: "My Mix" });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "",
			groupId: "grp-1",
		});
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "   ",
			groupId: "grp-1",
		});
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "a".repeat(30),
			groupId: "grp-1",
		});
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "a".repeat(31),
			groupId: "grp-1",
		});
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameVariant.create, { groupId: "grp-1" });
	});

	it("accepts shortLabel omitted (nullish)", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
		});
	});

	it("accepts shortLabel explicitly null", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
			shortLabel: null,
		});
	});

	it("accepts shortLabel at the 15-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
			shortLabel: "a".repeat(15),
		});
	});

	it("rejects a shortLabel longer than 15 characters", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
			shortLabel: "a".repeat(16),
		});
	});

	it("rejects an empty shortLabel", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			groupId: "grp-1",
			shortLabel: "",
		});
	});
});

describe("gameVariant.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.gameVariant.update, { id: "gv-1" });
	});

	it("accepts id + label", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "gv-1",
			label: "New Label",
		});
	});

	it("rejects empty label when provided", () => {
		expectRejects(appRouter.gameVariant.update, { id: "gv-1", label: "" });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			label: "a".repeat(31),
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameVariant.update, { label: "x" });
	});

	it("accepts shortLabel cleared to null", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "gv-1",
			shortLabel: null,
		});
	});

	it("rejects a shortLabel longer than 15 characters", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			shortLabel: "a".repeat(16),
		});
	});

	it("accepts a groupId change", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "gv-1",
			groupId: "grp-2",
		});
	});

	it("accepts sortOrder at the 0 boundary", () => {
		expectAccepts(appRouter.gameVariant.update, { id: "gv-1", sortOrder: 0 });
	});

	it("rejects a negative sortOrder", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			sortOrder: -1,
		});
	});

	it("rejects a non-integer sortOrder", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			sortOrder: 1.5,
		});
	});
});

describe("gameVariant.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.gameVariant.delete, { id: "gv-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameVariant.delete, {});
	});
});

describe("gameVariant.create groupId ownership (SA2-183)", () => {
	it("rejects a groupId owned by another user with FORBIDDEN", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OTHER_GROUP],
			[VARIANT_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({ label: "Brand New", groupId: OTHER_GROUP.id }),
			"FORBIDDEN"
		);
	});

	it("rejects a groupId that does not exist with FORBIDDEN (not NOT_FOUND)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
			[VARIANT_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({ label: "Brand New", groupId: "missing" }),
			"FORBIDDEN"
		);
	});

	it("accepts a groupId owned by the caller", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			// A dummy pre-existing row so the mock's post-insert lookup (which
			// does not actually filter by the fresh id — see test-utils.ts's
			// createChainableMockDb doc comment) resolves to something truthy.
			[VARIANT_TABLE]: [{ id: "placeholder", userId: CUR_OWNER, label: "X" }],
		});
		await expect(
			caller.create({ label: "Brand New", groupId: OWNED_GROUP.id })
		).resolves.toBeDefined();
	});
});

describe("gameVariant.update groupId ownership (SA2-183)", () => {
	it("rejects a groupId owned by another user with FORBIDDEN", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OTHER_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "Mine", groupId: "grp-1" },
			],
		});
		await expectTrpcCode(
			caller.update({ id: "gv-1", groupId: OTHER_GROUP.id }),
			"FORBIDDEN"
		);
	});
});

describe("gameVariant.create collision guard (CONFLICT)", () => {
	it("rejects the reserved key 'mix' (case-insensitive)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({ label: "mix", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
		await expectTrpcCode(
			caller.create({ label: "MIX", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});

	it("rejects the reserved label 'Mixed Game' (case-insensitive)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({ label: "mixed game", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});

	it("rejects a label colliding with the caller's existing variant label (case-insensitive)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
		});
		await expectTrpcCode(
			caller.create({ label: "my mix", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});

	it("accepts a genuinely new label with no collision", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "Other Mix", sortOrder: 0 },
			],
		});
		await expect(
			caller.create({ label: "Brand New", groupId: OWNED_GROUP.id })
		).resolves.toBeDefined();
	});

	it("rejects a label colliding with the caller's existing named-mix label (case-insensitive, cross-namespace)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
			[MIX_TABLE]: [{ id: "mix-1", userId: CUR_OWNER, label: "HORSE" }],
		});
		await expectTrpcCode(
			caller.create({ label: "horse", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});

	it("accepts a label with no collision in either the variant or mix namespace", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			// A dummy pre-existing row so the mock's post-insert lookup (which
			// does not actually filter by the fresh id) resolves to something
			// truthy.
			[VARIANT_TABLE]: [
				{ id: "placeholder", userId: CUR_OWNER, label: "X", sortOrder: 0 },
			],
			[MIX_TABLE]: [{ id: "mix-1", userId: CUR_OWNER, label: "8-Game" }],
		});
		await expect(
			caller.create({ label: "Brand New", groupId: OWNED_GROUP.id })
		).resolves.toBeDefined();
	});

	it("stamps the created row with the caller's userId, groupId, and a generated id", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await caller.create({ label: "Brand New", groupId: OWNED_GROUP.id });
		expect(inserted[VARIANT_TABLE]).toHaveLength(1);
		expect(inserted[VARIANT_TABLE]?.[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			groupId: OWNED_GROUP.id,
			builtinKey: null,
			sortOrder: 0,
		});
		expect(
			typeof (inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
	});

	it("sets sortOrder to (max existing sortOrder) + 1", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "A", sortOrder: 3 },
				{ id: "gv-2", userId: CUR_OWNER, label: "B", sortOrder: 7 },
			],
		});
		await caller.create({ label: "Brand New", groupId: OWNED_GROUP.id });
		expect(
			(inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.sortOrder
		).toBe(8);
	});

	it("starts sortOrder at 0 when the caller has no existing variants", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await caller.create({ label: "First", groupId: OWNED_GROUP.id });
		expect(
			(inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.sortOrder
		).toBe(0);
	});

	it("converts a (user_id, label) unique-constraint violation from the insert into the same CONFLICT (c14 backstop)", async () => {
		const { caller, db } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error(
					"UNIQUE constraint failed: game_variant.user_id, game_variant.label"
				);
			},
		});
		await expectTrpcCode(
			caller.create({ label: "Brand New", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});

	it("converts the migration-0041 label trigger abort into the same CONFLICT (the guard that actually fires)", async () => {
		const { caller, db } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error("game master label already exists");
			},
		});
		await expectTrpcCode(
			caller.create({ label: "Brand New", groupId: OWNED_GROUP.id }),
			"CONFLICT"
		);
	});
});

describe("gameVariant ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const { caller } = gameVariantCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [
					{ id: "gv-1", userId: CUR_OTHER, label: "Their Mix" },
				],
			});
			await expectTrpcCode(caller[op]({ id: "gv-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const { caller } = gameVariantCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [],
			});
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update resolves for a row owned by the caller", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
		});
		await expect(
			caller.update({ id: "gv-1", label: "Renamed Mix" })
		).resolves.toBeDefined();
	});

	it("delete resolves for a row owned by the caller", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [{ id: "gv-1", userId: CUR_OWNER, label: "My Mix" }],
		});
		await expect(caller.delete({ id: "gv-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameVariant.delete in-use rejection (c07)", () => {
	it("rejects with CONFLICT when a mix references the id", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [{ id: "gv-1", userId: CUR_OWNER, label: "My Mix" }],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "HORSE", games: ["gv-1"] },
			],
		});
		await expectTrpcCode(caller.delete({ id: "gv-1" }), "CONFLICT");
	});

	it("succeeds when no mix references the id", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [{ id: "gv-1", userId: CUR_OWNER, label: "My Mix" }],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "HORSE", games: ["gv-2"] },
			],
		});
		await expect(caller.delete({ id: "gv-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameVariant.update excludes self from collision", () => {
	it("succeeds when keeping the row's own (unchanged) label", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
		});
		await expect(
			caller.update({ id: "gv-1", label: "My Mix" })
		).resolves.toBeDefined();
	});

	it("still rejects renaming to a different existing variant label (CONFLICT)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
				{ id: "gv-2", userId: CUR_OWNER, label: "Other Mix", sortOrder: 1 },
			],
		});
		await expectTrpcCode(
			caller.update({ id: "gv-1", label: "Other Mix" }),
			"CONFLICT"
		);
	});

	it("rejects renaming to an existing named-mix label (CONFLICT, cross-namespace)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
			[MIX_TABLE]: [{ id: "mix-1", userId: CUR_OWNER, label: "10-Game" }],
		});
		await expectTrpcCode(
			caller.update({ id: "gv-1", label: "10-Game" }),
			"CONFLICT"
		);
	});
});

describe("gameVariant write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const { caller, updateWhereParams } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", userId: CUR_OWNER, label: "My Mix", sortOrder: 0 },
			],
		});
		await caller.update({ id: "gv-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("gv-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const { caller, deleteWhereParams } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [{ id: "gv-1", userId: CUR_OWNER, label: "My Mix" }],
		});
		await caller.delete({ id: "gv-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("gv-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameVariant.list scoping", () => {
	it("queries scoped to the caller's userId when already seeded", async () => {
		const rows = seededRows({
			variant: [
				{ id: "gv-1", userId: CUR_OWNER, label: "Zed Mix", sortOrder: 1 },
				{ id: "gv-2", userId: CUR_OWNER, label: "Alpha Mix", sortOrder: 0 },
			],
		});
		const { caller, selectWhereParams } = gameVariantCaller(CUR_OWNER, rows);
		const result = await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
		expect(result).toHaveLength(2);
	});

	it("self-seeds when the caller has zero groups and zero variants", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
			[VARIANT_TABLE]: [],
		});
		await caller.list();
		// Seeding inserts 3 builtin groups + 21 builtin variants + 3 builtin
		// mixes (game-mix rework) in one batch.
		expect(inserted[GROUP_TABLE]).toHaveLength(3);
		expect(inserted[VARIANT_TABLE]).toHaveLength(21);
		expect(inserted[MIX_TABLE]).toHaveLength(3);
	});

	it("does not re-seed when the caller already has a group (even with zero variants)", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await caller.list();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(inserted[MIX_TABLE]).toBeUndefined();
	});
});

describe("gameVariant type guard sanity", () => {
	it("getInputSchema works for create", () => {
		const schema = getInputSchema(appRouter.gameVariant.create);
		expect(schema.safeParse({ label: "x", groupId: "g1" }).success).toBe(true);
	});
});
