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
	expectProcedureSurface,
	expectRejects,
	withGameMixVariantFixtures,
} from "./test-utils";

type Rows = Record<string, unknown>[];

const GROUP_TABLE = getTableName(gameGroup);
const VARIANT_TABLE = getTableName(gameVariant);
const MIX_TABLE = getTableName(gameMix);
const MIX_VARIANT_TABLE = "game_mix_variant";
const MAX_MIX_VARIANT_ROWS_PER_INSERT = 25;

function flattenedWrites(
	writes: unknown[] | undefined
): Record<string, unknown>[] {
	return (writes ?? []).flatMap((entry) =>
		Array.isArray(entry) ? entry : [entry]
	) as Record<string, unknown>[];
}

function gameMixCaller(userId: string, select: Record<string, Rows>) {
	const mock = createChainableMockDb({
		select: withGameMixVariantFixtures(select),
	});
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

function seededRows(extra: { variant?: Rows; group?: Rows; mix?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [OWNED_GROUP],
		[VARIANT_TABLE]: extra.variant ?? [OWNED_VARIANT_1],
		[MIX_TABLE]: extra.mix ?? [
			{ id: "mix-1", userId: CUR_OWNER, label: "X", games: [] },
		],
	};
}

const writers = [
	["create", appRouter.gameMix.create, { games: ["v1", "v2"] }],
	["update", appRouter.gameMix.update, { id: "mix-1" }],
] as const;

describe("gameMix router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameMix).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.gameMix, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("gameMix label validation", () => {
	it.each(writers)("%s rejects an empty label", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "" });
	});

	it.each(
		writers
	)("%s rejects a whitespace-only label (trimmed to empty)", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "   " });
	});

	it.each(
		writers
	)("%s accepts a label at the 30-character boundary", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, label: "a".repeat(30) });
	});

	it.each(
		writers
	)("%s rejects a label longer than 30 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, label: "a".repeat(31) });
	});
});

describe("gameMix games validation", () => {
	it.each(
		writers
	)("%s accepts a games array at the 2- and 30-entry boundaries", (_name, procedure, base) => {
		for (const length of [2, 30]) {
			expectAccepts(procedure, {
				...base,
				label: "My Mix",
				games: Array.from({ length }, (_, i) => `v${i}`),
			});
		}
	});

	it.each(
		writers
	)("%s rejects a games array with 0, 1 or 31 entries", (_name, procedure, base) => {
		for (const length of [0, 1, 31]) {
			expectRejects(procedure, {
				...base,
				label: "My Mix",
				games: Array.from({ length }, (_, i) => `v${i}`),
			});
		}
	});
});

describe("gameMix.create games ownership (SA2-183)", () => {
	it("rejects a games array containing a variant id owned by another user (FORBIDDEN)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
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

	it("stores mix metadata, normalized rows, and the rolling-deploy mirror atomically", async () => {
		const { caller, inserted, updated, selectWhereParams } = gameMixCaller(
			CUR_OWNER,
			{
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
			}
		);
		await caller.create({
			label: "Brand New",
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			builtinKey: null,
		});
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({ games: [] });
		expect(
			typeof (inserted[MIX_TABLE]?.[0] as Record<string, unknown>)?.id
		).toBe("string");
		const createdId = (inserted[MIX_TABLE]?.[0] as Record<string, unknown>).id;
		expect(selectWhereParams).toContainEqual([createdId, CUR_OWNER]);
		expect(flattenedWrites(inserted[MIX_VARIANT_TABLE])).toEqual([
			{
				mixId: createdId,
				position: 0,
				userId: CUR_OWNER,
				variantId: OWNED_VARIANT_1.id,
			},
			{
				mixId: createdId,
				position: 1,
				userId: CUR_OWNER,
				variantId: OWNED_VARIANT_2.id,
			},
		]);
		expect(updated[MIX_TABLE]?.at(-1)).toMatchObject({
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
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
		const { caller, inserted } = gameMixCaller(CUR_OWNER, {
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
		await caller.create({
			label: "Exactly 12",
			games: variants.map((v) => v.id as string),
		});
		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(flattenedWrites(inserted[MIX_VARIANT_TABLE])).toHaveLength(12);
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
		const { caller, updated } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		const games = variants.map((v) => v.id as string);
		await caller.update({ id: "mix-1", games });
		expect(updated[MIX_TABLE]?.at(-1)).toMatchObject({ games });
	});
});

describe("gameMix.create collision guard (CONFLICT)", () => {
	it.each([
		"mix",
		"MIX",
	])("rejects the reserved key %s (case-insensitive)", async (label) => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				label,
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

	it("inserts a genuinely new label with no collision", async () => {
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
			label: "Brand New Mix",
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({ label: "Brand New Mix" });
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

	it("update writes the new label for a row owned by the caller", async () => {
		const { caller, updated } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await caller.update({ id: "mix-1", label: "Renamed Mix" });
		expect(updated[MIX_TABLE]).toHaveLength(1);
		expect(updated[MIX_TABLE]?.[0]).toMatchObject({ label: "Renamed Mix" });
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
	it("writes the row's own (unchanged) label without a self-collision", async () => {
		const { caller, updated } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
			],
		});
		await caller.update({ id: "mix-1", label: "My Mix" });
		expect(updated[MIX_TABLE]?.[0]).toMatchObject({ label: "My Mix" });
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

describe("gameMix.list ownership filtering", () => {
	it("filters out mixes not owned by the caller before hydrating games", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "owned", userId: CUR_OWNER, label: "Mine", games: [] },
				{ id: "other", userId: CUR_OTHER, label: "Theirs", games: [] },
			],
			[MIX_VARIANT_TABLE]: [],
		});
		const result = (await caller.list()) as { id: string }[];
		expect(result.map((mix) => mix.id)).toEqual(["owned"]);
	});
});

describe("gameMix normalized membership persistence", () => {
	it("hydrates every listed mix from one junction read and preserves position order", async () => {
		const { caller, selectedTables, selectWhereParams } = gameMixCaller(
			CUR_OWNER,
			{
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
				[MIX_TABLE]: [
					{
						id: "mix-a",
						userId: CUR_OWNER,
						builtinKey: "horse",
						label: "HORSE",
					},
					{
						id: "mix-b",
						userId: CUR_OWNER,
						builtinKey: null,
						label: "Custom",
					},
				],
				[MIX_VARIANT_TABLE]: [
					{
						mixId: "mix-a",
						variantId: OWNED_VARIANT_1.id,
						userId: CUR_OWNER,
						position: 1,
					},
					{
						mixId: "mix-b",
						variantId: OWNED_VARIANT_1.id,
						userId: CUR_OWNER,
						position: 0,
					},
					{
						mixId: "mix-a",
						variantId: OWNED_VARIANT_2.id,
						userId: CUR_OWNER,
						position: 0,
					},
				],
			}
		);

		const result = (await caller.list()) as Array<{
			games: string[];
			id: string;
		}>;
		expect(result.find((mix) => mix.id === "mix-a")?.games).toEqual([
			OWNED_VARIANT_2.id,
			OWNED_VARIANT_1.id,
		]);
		expect(result.find((mix) => mix.id === "mix-b")?.games).toEqual([
			OWNED_VARIANT_1.id,
		]);
		expect(selectedTables).toEqual([MIX_TABLE, MIX_VARIANT_TABLE]);
		expect(selectWhereParams).toEqual([
			[CUR_OWNER],
			[CUR_OWNER, "mix-a", "mix-b"],
		]);
	});

	it("narrows the junction read to the listed mixes instead of scanning the owner", async () => {
		const { caller, selectWhereParams } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-a", userId: CUR_OWNER, builtinKey: null, label: "A" },
				{ id: "mix-b", userId: CUR_OWNER, builtinKey: null, label: "B" },
			],
			[MIX_VARIANT_TABLE]: [
				{
					mixId: "mix-a",
					variantId: OWNED_VARIANT_1.id,
					userId: CUR_OWNER,
					position: 0,
				},
			],
		});

		await caller.list();

		expect(selectWhereParams.at(-1)).toEqual([CUR_OWNER, "mix-a", "mix-b"]);
	});

	it("keeps the junction read owner-scoped only when the id list would overflow D1's bind cap", async () => {
		const mixes = Array.from({ length: 100 }, (_, index) => ({
			id: `mix-${index}`,
			userId: CUR_OWNER,
			builtinKey: null,
			label: `Mix ${index}`,
		}));
		const { caller, selectWhereParams } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: mixes,
			[MIX_VARIANT_TABLE]: [],
		});

		await caller.list();

		expect(selectWhereParams.at(-1)).toEqual([CUR_OWNER]);
	});

	it("hydrates a label-only update from a single-mix junction read", async () => {
		const { caller, selectWhereParams } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{ id: "mix-1", userId: CUR_OWNER, builtinKey: null, label: "Renamed" },
			],
			[MIX_VARIANT_TABLE]: [
				{
					mixId: "mix-1",
					variantId: OWNED_VARIANT_1.id,
					userId: CUR_OWNER,
					position: 0,
				},
			],
		});

		const updated = (await caller.update({
			id: "mix-1",
			label: "Renamed",
		})) as { games: string[] };

		expect(updated.games).toEqual([OWNED_VARIANT_1.id]);
		expect(selectWhereParams.at(-1)).toEqual([CUR_OWNER, "mix-1"]);
	});

	it("creates a 30-game mix with normalized rows and a compatibility mirror in one batch", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			id: `variant-${index}`,
			userId: CUR_OWNER,
			groupId: OWNED_GROUP.id,
			label: `Variant ${index}`,
		}));
		const games = variants.map((variant) => variant.id);
		const { caller, inserted, updated, batch } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{
					id: "placeholder",
					userId: CUR_OWNER,
					label: "Placeholder",
				},
			],
			[MIX_VARIANT_TABLE]: [],
		});

		const created = await caller.create({ label: "Thirty Game", games });

		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({ games: [] });
		expect(updated[MIX_TABLE]?.at(-1)).toMatchObject({ games });
		expect(created?.games).toEqual(games);
		const membershipWrites = inserted[MIX_VARIANT_TABLE] ?? [];
		expect(membershipWrites).toHaveLength(2);
		for (const chunk of membershipWrites) {
			const rows = Array.isArray(chunk) ? chunk : [chunk];
			expect(rows.length).toBeLessThanOrEqual(MAX_MIX_VARIANT_ROWS_PER_INSERT);
			expect(rows.length * 4).toBeLessThanOrEqual(100);
		}
		const memberships = flattenedWrites(membershipWrites);
		expect(memberships).toHaveLength(30);
		expect(memberships.map((row) => row.variantId)).toEqual(games);
		expect(memberships.map((row) => row.position)).toEqual(
			Array.from({ length: 30 }, (_, index) => index)
		);
		expect(memberships.every((row) => row.userId === CUR_OWNER)).toBe(true);
		expect(new Set(memberships.map((row) => row.mixId)).size).toBe(1);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
	});

	it("chunks membership inserts by the row's real column count, not a literal width", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			id: `variant-${index}`,
			userId: CUR_OWNER,
			groupId: OWNED_GROUP.id,
			label: `Variant ${index}`,
		}));
		const { caller, inserted } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [{ id: "placeholder", userId: CUR_OWNER, label: "P" }],
			[MIX_VARIANT_TABLE]: [],
		});

		await caller.create({
			label: "Thirty Game",
			games: variants.map((variant) => variant.id),
		});

		const chunks = (inserted[MIX_VARIANT_TABLE] ?? []).map((entry) =>
			Array.isArray(entry) ? entry : [entry]
		) as Record<string, unknown>[][];
		const columnsPerRow = Object.keys(chunks[0]?.[0] ?? {}).length;
		expect(columnsPerRow).toBeGreaterThan(0);
		expect(chunks.map((chunk) => chunk.length)).toEqual([
			Math.floor(100 / columnsPerRow),
			30 - Math.floor(100 / columnsPerRow),
		]);
		for (const chunk of chunks) {
			expect(chunk.length * columnsPerRow).toBeLessThanOrEqual(100);
		}
	});

	it("replaces a 30-game composition and compatibility mirror atomically", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			id: `replacement-${index}`,
			userId: CUR_OWNER,
			groupId: OWNED_GROUP.id,
			label: `Replacement ${index}`,
		}));
		const games = variants.map((variant) => variant.id);
		const { caller, inserted, updated, batch, deleteWhereParams } =
			gameMixCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: variants,
				[MIX_TABLE]: [
					{
						id: "mix-1",
						userId: CUR_OWNER,
						label: "My Mix",
					},
				],
				[MIX_VARIANT_TABLE]: [
					{
						mixId: "mix-1",
						variantId: "old-variant",
						userId: CUR_OWNER,
						position: 0,
					},
				],
			});

		const updatedMix = await caller.update({ id: "mix-1", games });

		expect(updated[MIX_TABLE]).toHaveLength(1);
		expect(updated[MIX_TABLE]?.[0]).toMatchObject({ games });
		expect(updatedMix?.games).toEqual(games);
		const membershipWrites = inserted[MIX_VARIANT_TABLE] ?? [];
		expect(membershipWrites).toHaveLength(2);
		const memberships = flattenedWrites(membershipWrites);
		expect(memberships.map((row) => row.variantId)).toEqual(games);
		expect(memberships.map((row) => row.position)).toEqual(
			Array.from({ length: 30 }, (_, index) => index)
		);
		expect(memberships.every((row) => row.userId === CUR_OWNER)).toBe(true);
		expect(deleteWhereParams).toContainEqual(["mix-1", CUR_OWNER]);
		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(4);
	});
});
