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
	expectRejects,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);

function gameVariantCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		db: mock.db,
		session: { user: { id: userId } },
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
const OWNED_GROUP = {
	archivedAt: null,
	id: "grp-1",
	label: "Big Bet",
	userId: CUR_OWNER,
};
const OTHER_GROUP = { id: "grp-2", label: "Their Group", userId: CUR_OTHER };

function seededRows(extra: { variant?: Rows; group?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [OWNED_GROUP],
		[VARIANT_TABLE]: extra.variant ?? [{ id: "v-1", userId: CUR_OWNER }],
	};
}

describe("gameVariant.create input validation", () => {
	it("accepts a minimal valid payload", () => {
		expectAccepts(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
		});
	});

	it("rejects missing groupId", () => {
		expectRejects(appRouter.gameVariant.create, { label: "My Mix" });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "",
		});
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "   ",
		});
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "a".repeat(30),
		});
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "a".repeat(31),
		});
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameVariant.create, { groupId: "grp-1" });
	});

	it("accepts shortLabel omitted (nullish)", () => {
		expectAccepts(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
		});
	});

	it("accepts shortLabel explicitly null", () => {
		expectAccepts(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
			shortLabel: null,
		});
	});

	it("accepts shortLabel at the 15-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
			shortLabel: "a".repeat(15),
		});
	});

	it("rejects a shortLabel longer than 15 characters", () => {
		expectRejects(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
			shortLabel: "a".repeat(16),
		});
	});

	it("rejects an empty shortLabel", () => {
		expectRejects(appRouter.gameVariant.create, {
			groupId: "grp-1",
			label: "My Mix",
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
			groupId: "grp-2",
			id: "gv-1",
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
			caller.create({ groupId: OTHER_GROUP.id, label: "Brand New" }),
			"FORBIDDEN"
		);
	});

	it("rejects a groupId that does not exist with FORBIDDEN (not NOT_FOUND)", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
			[VARIANT_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({ groupId: "missing", label: "Brand New" }),
			"FORBIDDEN"
		);
	});

	it("accepts a groupId owned by the caller", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [{ id: "placeholder", label: "X", userId: CUR_OWNER }],
		});
		await expect(
			caller.create({ groupId: OWNED_GROUP.id, label: "Brand New" })
		).resolves.toBeDefined();
	});
});

describe("gameVariant.update groupId ownership (SA2-183)", () => {
	it("rejects a groupId owned by another user with FORBIDDEN", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OTHER_GROUP],
			[VARIANT_TABLE]: [
				{ groupId: "grp-1", id: "gv-1", label: "Mine", userId: CUR_OWNER },
			],
		});
		await expectTrpcCode(
			caller.update({ groupId: OTHER_GROUP.id, id: "gv-1" }),
			"FORBIDDEN"
		);
	});
});

describe("gameVariant.create", () => {
	it("stamps the created row with the caller's userId, groupId, and a generated id", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await caller.create({ groupId: OWNED_GROUP.id, label: "Brand New" });
		expect(inserted[VARIANT_TABLE]).toHaveLength(1);
		expect(inserted[VARIANT_TABLE]?.[0]).toMatchObject({
			builtinKey: null,
			groupId: OWNED_GROUP.id,
			label: "Brand New",
			sortOrder: 0,
			userId: CUR_OWNER,
		});
		expect(
			typeof (inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
	});

	it("sets sortOrder to (max existing sortOrder) + 1", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [
				{ id: "gv-1", label: "A", sortOrder: 3, userId: CUR_OWNER },
				{ id: "gv-2", label: "B", sortOrder: 7, userId: CUR_OWNER },
			],
		});
		await caller.create({ groupId: OWNED_GROUP.id, label: "Brand New" });
		expect(
			(inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.sortOrder
		).toBe(8);
	});

	it("starts sortOrder at 0 when the caller has no existing variants", async () => {
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [],
		});
		await caller.create({ groupId: OWNED_GROUP.id, label: "First" });
		expect(
			(inserted[VARIANT_TABLE]?.[0] as Record<string, unknown>)?.sortOrder
		).toBe(0);
	});
});

describe("gameVariant.list scoping", () => {
	it("queries scoped to the caller's userId when already seeded", async () => {
		const rows = seededRows({
			variant: [
				{
					archivedAt: null,
					id: "gv-1",
					label: "Zed Mix",
					sortOrder: 1,
					userId: CUR_OWNER,
				},
				{
					archivedAt: null,
					id: "gv-2",
					label: "Alpha Mix",
					sortOrder: 0,
					userId: CUR_OWNER,
				},
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
		expect(schema.safeParse({ groupId: "g1", label: "x" }).success).toBe(true);
	});
});
