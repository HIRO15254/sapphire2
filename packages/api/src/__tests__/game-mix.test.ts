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

function gameMixCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameMix;
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
const OWNED_VARIANT_1 = { id: "gv-1", userId: CUR_OWNER, label: "NL Hold'em" };
const OWNED_VARIANT_2 = {
	id: "gv-2",
	userId: CUR_OWNER,
	label: "Limit Hold'em",
};
const OTHER_VARIANT = { id: "gv-x", userId: CUR_OTHER, label: "Their Mix" };

/** Non-empty group/variant/mix rows so list()'s self-seed guard is skipped. */
function seededRows(extra: { variant?: Rows; group?: Rows; mix?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [OWNED_GROUP],
		[VARIANT_TABLE]: extra.variant ?? [OWNED_VARIANT_1],
		[MIX_TABLE]: extra.mix ?? [
			{ id: "mix-1", userId: CUR_OWNER, label: "X", games: [] },
		],
	};
}

describe("gameMix router", () => {
	it("appRouter has gameMix namespace", () => {
		expect(appRouter.gameMix).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameMix).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.gameMix.list);
		expectType(appRouter.gameMix.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.gameMix.create,
			appRouter.gameMix.update,
			appRouter.gameMix.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("gameMix.create input validation", () => {
	it("accepts a minimal valid payload", () => {
		expectAccepts(appRouter.gameMix.create, {
			label: "My Mix",
			games: ["v1", "v2"],
		});
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameMix.create, { games: ["v1", "v2"] });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameMix.create, { label: "", games: ["v1", "v2"] });
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameMix.create, {
			label: "   ",
			games: ["v1", "v2"],
		});
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameMix.create, {
			label: "a".repeat(30),
			games: ["v1", "v2"],
		});
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameMix.create, {
			label: "a".repeat(31),
			games: ["v1", "v2"],
		});
	});

	it("rejects missing games", () => {
		expectRejects(appRouter.gameMix.create, { label: "My Mix" });
	});

	it("rejects an empty games array", () => {
		expectRejects(appRouter.gameMix.create, { label: "My Mix", games: [] });
	});

	it("rejects a games array with a single entry (a mix needs at least two games)", () => {
		expectRejects(appRouter.gameMix.create, { label: "My Mix", games: ["v1"] });
	});

	it("accepts a games array at the 2-entry boundary", () => {
		expectAccepts(appRouter.gameMix.create, {
			label: "My Mix",
			games: ["v1", "v2"],
		});
	});

	it("accepts a games array at the 30-entry boundary", () => {
		const games = Array.from({ length: 30 }, (_, i) => `v${i}`);
		expectAccepts(appRouter.gameMix.create, { label: "My Mix", games });
	});

	it("rejects a games array with 31 entries", () => {
		const games = Array.from({ length: 31 }, (_, i) => `v${i}`);
		expectRejects(appRouter.gameMix.create, { label: "My Mix", games });
	});
});

describe("gameMix.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.gameMix.update, { id: "mix-1" });
	});

	it("accepts id + label", () => {
		expectAccepts(appRouter.gameMix.update, {
			id: "mix-1",
			label: "New Label",
		});
	});

	it("rejects empty label when provided", () => {
		expectRejects(appRouter.gameMix.update, { id: "mix-1", label: "" });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameMix.update, {
			id: "mix-1",
			label: "a".repeat(31),
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameMix.update, { label: "x" });
	});

	it("accepts a games array when provided", () => {
		expectAccepts(appRouter.gameMix.update, {
			id: "mix-1",
			games: ["v1", "v2"],
		});
	});

	it("rejects a provided games array with a single entry", () => {
		expectRejects(appRouter.gameMix.update, { id: "mix-1", games: ["v1"] });
	});

	it("rejects a provided games array with 31 entries", () => {
		const games = Array.from({ length: 31 }, (_, i) => `v${i}`);
		expectRejects(appRouter.gameMix.update, { id: "mix-1", games });
	});

	it("accepts a games array at the 30-entry boundary", () => {
		const games = Array.from({ length: 30 }, (_, i) => `v${i}`);
		expectAccepts(appRouter.gameMix.update, { id: "mix-1", games });
	});
});

describe("gameMix.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.gameMix.delete, { id: "mix-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameMix.delete, {});
	});
});

describe("gameMix.create games ownership (SA2-183)", () => {
	it("rejects a games array containing a variant id owned by another user (FORBIDDEN)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			// Simulates the filtered `WHERE id IN (…) AND userId = caller` query
			// returning only the caller-owned row (see test-utils.ts's
			// createChainableMockDb doc comment).
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, OTHER_VARIANT.id],
			}),
			"FORBIDDEN"
		);
	});

	it("rejects a games array containing a nonexistent variant id (FORBIDDEN, not NOT_FOUND)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, "missing-id"],
			}),
			"FORBIDDEN"
		);
	});

	it("accepts a games array fully owned by the caller", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			// A dummy pre-existing row so the mock's post-insert lookup (which
			// does not actually filter by the fresh id) resolves to something
			// truthy (mirrors game-variant.test.ts's "placeholder" convention).
			[MIX_TABLE]: [
				{
					id: "placeholder",
					userId: CUR_OWNER,
					label: "Placeholder",
					games: [],
				},
			],
		});
		await expect(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			})
		).resolves.toBeDefined();
	});

	it("stamps the created row with the caller's userId, null builtinKey, a generated id, and the ordered games array", async () => {
		const { caller, inserted } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [
				{
					id: "placeholder",
					userId: CUR_OWNER,
					label: "Placeholder",
					games: [],
				},
			],
		});
		await caller.create({
			label: "Brand New",
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			builtinKey: null,
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(
			typeof (inserted[MIX_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
	});
});

describe("gameMix.update games ownership (SA2-183)", () => {
	it("rejects updating games to include a variant id owned by another user (FORBIDDEN)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.update({
				id: "mix-1",
				games: [OWNED_VARIANT_1.id, OTHER_VARIANT.id],
			}),
			"FORBIDDEN"
		);
	});
});

describe("gameMix.create duplicate games guard (BAD_REQUEST)", () => {
	it("rejects a games array with a duplicate id", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_1.id],
			}),
			"BAD_REQUEST"
		);
	});
});

describe("gameMix.update duplicate games guard (BAD_REQUEST)", () => {
	it("rejects a games array with a duplicate id", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.update({
				id: "mix-1",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_1.id],
			}),
			"BAD_REQUEST"
		);
	});
});

/** N owned variants, each in its own distinct game group. */
function variantsAcrossGroups(n: number): Rows {
	return Array.from({ length: n }, (_, i) => ({
		id: `gv-span-${i}`,
		userId: CUR_OWNER,
		groupId: `grp-span-${i}`,
		label: `Span Variant ${i}`,
	}));
}

describe("gameMix group-span guard (c58, max 12 groups)", () => {
	it("create rejects when the owned variants span 13 distinct game groups", async () => {
		const variants = variantsAcrossGroups(13);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "Too Wide",
				games: variants.map((v) => v.id as string),
			}),
			"BAD_REQUEST"
		);
	});

	it("create accepts when the owned variants span exactly 12 distinct game groups (boundary)", async () => {
		const variants = variantsAcrossGroups(12);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{
					id: "placeholder",
					userId: CUR_OWNER,
					label: "Placeholder",
					games: [],
				},
			],
		});
		await expect(
			caller.create({
				label: "Exactly 12",
				games: variants.map((v) => v.id as string),
			})
		).resolves.toBeDefined();
	});

	it("update rejects when the owned variants span 13 distinct game groups", async () => {
		const variants = variantsAcrossGroups(13);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.update({
				id: "mix-1",
				games: variants.map((v) => v.id as string),
			}),
			"BAD_REQUEST"
		);
	});

	it("update accepts when the owned variants span exactly 12 distinct game groups (boundary)", async () => {
		const variants = variantsAcrossGroups(12);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expect(
			caller.update({
				id: "mix-1",
				games: variants.map((v) => v.id as string),
			})
		).resolves.toBeDefined();
	});
});

describe("gameMix.create collision guard (CONFLICT)", () => {
	it("rejects the reserved key 'mix' (case-insensitive)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
		await expectTrpcCode(
			caller.create({
				label: "MIX",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("rejects the reserved label 'Mixed Game' (case-insensitive)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "mixed game",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("rejects a label colliding with the caller's existing mix label (case-insensitive)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.create({
				label: "my mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("rejects a label colliding with the caller's existing variant label (case-insensitive, cross-namespace)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label: "nl hold'em",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("accepts a genuinely new label with no collision", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [
				{
					id: "placeholder",
					userId: CUR_OWNER,
					label: "Placeholder",
					games: [],
				},
			],
		});
		await expect(
			caller.create({
				label: "Brand New Mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			})
		).resolves.toBeDefined();
	});

	it("converts a (user_id, label) unique-constraint violation from the insert into the same CONFLICT (c14 backstop)", async () => {
		const { caller, db } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error(
					"UNIQUE constraint failed: game_mix.user_id, game_mix.label"
				);
			},
		});
		await expectTrpcCode(
			caller.create({
				label: "Brand New Mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("converts the migration-0041 label trigger abort into the same CONFLICT (the guard that actually fires)", async () => {
		const { caller, db } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		db.insert = () => ({
			values: () => {
				throw new Error("game master label already exists");
			},
		});
		await expectTrpcCode(
			caller.create({
				label: "Brand New Mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});
});

describe("gameMix ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const { caller } = gameMixCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [OWNED_VARIANT_1],
				[MIX_TABLE]: [
					{ id: "mix-1", userId: CUR_OTHER, label: "Their Mix", games: [] },
				],
			});
			await expectTrpcCode(caller[op]({ id: "mix-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const { caller } = gameMixCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [OWNED_VARIANT_1],
				[MIX_TABLE]: [],
			});
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update resolves for a row owned by the caller", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expect(
			caller.update({ id: "mix-1", label: "Renamed Mix" })
		).resolves.toBeDefined();
	});

	it("delete resolves for a row owned by the caller", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expect(caller.delete({ id: "mix-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameMix.update excludes self from collision", () => {
	it("succeeds when keeping the row's own (unchanged) label", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expect(
			caller.update({ id: "mix-1", label: "My Mix" })
		).resolves.toBeDefined();
	});

	it("still rejects renaming to a different existing mix label (CONFLICT)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
				{ id: "mix-2", userId: CUR_OWNER, label: "Other Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.update({ id: "mix-1", label: "Other Mix" }),
			"CONFLICT"
		);
	});

	it("still rejects renaming to an existing variant label (CONFLICT, cross-namespace)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await expectTrpcCode(
			caller.update({ id: "mix-1", label: "NL Hold'em" }),
			"CONFLICT"
		);
	});
});

describe("gameMix write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const { caller, updateWhereParams } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await caller.update({ id: "mix-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("mix-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const { caller, deleteWhereParams } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await caller.delete({ id: "mix-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("mix-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameMix.list ordering + self-seed", () => {
	it("orders builtin mixes horse -> 8game -> 10game ahead of custom mixes", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{
					id: "custom-1",
					userId: CUR_OWNER,
					builtinKey: null,
					label: "Zeta Custom",
				},
				{
					id: "eight-1",
					userId: CUR_OWNER,
					builtinKey: "8game",
					label: "8-Game",
				},
				{
					id: "custom-2",
					userId: CUR_OWNER,
					builtinKey: null,
					label: "Alpha Custom",
				},
				{
					id: "ten-1",
					userId: CUR_OWNER,
					builtinKey: "10game",
					label: "10-Game",
				},
				{
					id: "horse-1",
					userId: CUR_OWNER,
					builtinKey: "horse",
					label: "HORSE",
				},
			],
		});
		const result = (await caller.list()) as { id: string }[];
		expect(result.map((r) => r.id)).toEqual([
			"horse-1",
			"eight-1",
			"ten-1",
			"custom-2",
			"custom-1",
		]);
	});

	it("self-seeds when the caller has zero groups and zero variants", async () => {
		const { caller, inserted } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [],
			[VARIANT_TABLE]: [],
		});
		await caller.list();
		expect(inserted[GROUP_TABLE]).toHaveLength(3);
		expect(inserted[VARIANT_TABLE]).toHaveLength(21);
		expect(inserted[MIX_TABLE]).toHaveLength(3);
	});

	it("does not re-seed when the caller already has a group", async () => {
		const { caller, inserted } = gameMixCaller(CUR_OWNER, seededRows());
		await caller.list();
		expect(inserted[GROUP_TABLE]).toBeUndefined();
		expect(inserted[VARIANT_TABLE]).toBeUndefined();
		expect(inserted[MIX_TABLE]).toBeUndefined();
	});

	it("scopes the list query to the caller's userId", async () => {
		const rows = seededRows({
			mix: [{ id: "mix-1", userId: CUR_OWNER, label: "X", games: [] }],
		});
		const { caller, selectWhereParams } = gameMixCaller(CUR_OWNER, rows);
		await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
	});
});

describe("gameMix type guard sanity", () => {
	it("getInputSchema works for create", () => {
		const schema = getInputSchema(appRouter.gameMix.create);
		expect(schema.safeParse({ label: "x", games: ["v1", "v2"] }).success).toBe(
			true
		);
	});
});
