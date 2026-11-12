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
	const defaults: Record<string, Record<string, unknown>> = {
		[MIX_TABLE]: { archivedAt: null },
		[VARIANT_TABLE]: {
			archivedAt: null,
			groupBuiltinKey: null,
			groupId: "grp-1",
			groupLabel: "Big Bet",
			sortOrder: 0,
		},
	};
	const activeRows = Object.fromEntries(
		Object.entries(select).map(([table, rows]) => [
			table,
			rows.map((row) => ({ ...defaults[table], ...row })),
		])
	);
	const mock = createChainableMockDb({
		select: withGameMixVariantFixtures(activeRows),
	});
	const caller = appRouter.createCaller({
		db: mock.db,
		session: { user: { id: userId } },
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
const OWNED_GROUP = { id: "grp-1", label: "Big Bet", userId: CUR_OWNER };
const OWNED_VARIANT_1 = {
	id: "gv-1",
	label: "NL Hold'em",
	sortOrder: 0,
	userId: CUR_OWNER,
};
const OWNED_VARIANT_2 = {
	id: "gv-2",
	label: "Limit Hold'em",
	sortOrder: 1,
	userId: CUR_OWNER,
};
const OTHER_VARIANT = { id: "gv-x", label: "Their Mix", userId: CUR_OTHER };

function seededRows(extra: { variant?: Rows; group?: Rows; mix?: Rows } = {}) {
	return {
		[GROUP_TABLE]: extra.group ?? [OWNED_GROUP],
		[VARIANT_TABLE]: extra.variant ?? [OWNED_VARIANT_1],
		[MIX_TABLE]: extra.mix ?? [{ id: "mix-1", label: "X", userId: CUR_OWNER }],
	};
}

describe("gameMix.create input validation", () => {
	it("accepts a minimal valid payload", () => {
		expectAccepts(appRouter.gameMix.create, {
			games: ["v1", "v2"],
			label: "My Mix",
		});
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameMix.create, { games: ["v1", "v2"] });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameMix.create, { games: ["v1", "v2"], label: "" });
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameMix.create, {
			games: ["v1", "v2"],
			label: "   ",
		});
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameMix.create, {
			games: ["v1", "v2"],
			label: "a".repeat(30),
		});
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameMix.create, {
			games: ["v1", "v2"],
			label: "a".repeat(31),
		});
	});

	it("rejects missing games", () => {
		expectRejects(appRouter.gameMix.create, { label: "My Mix" });
	});

	it("rejects an empty games array", () => {
		expectRejects(appRouter.gameMix.create, { games: [], label: "My Mix" });
	});

	it("rejects a games array with a single entry (a mix needs at least two games)", () => {
		expectRejects(appRouter.gameMix.create, { games: ["v1"], label: "My Mix" });
	});

	it("accepts a games array at the 2-entry boundary", () => {
		expectAccepts(appRouter.gameMix.create, {
			games: ["v1", "v2"],
			label: "My Mix",
		});
	});

	it("accepts a games array at the 60-entry boundary", () => {
		const games = Array.from({ length: 60 }, (_, i) => `v${i}`);
		expectAccepts(appRouter.gameMix.create, { games, label: "My Mix" });
	});

	it("rejects a games array with 61 entries", () => {
		const games = Array.from({ length: 61 }, (_, i) => `v${i}`);
		expectRejects(appRouter.gameMix.create, { games, label: "My Mix" });
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
			games: ["v1", "v2"],
			id: "mix-1",
		});
	});

	it("rejects a provided games array with a single entry", () => {
		expectRejects(appRouter.gameMix.update, { games: ["v1"], id: "mix-1" });
	});

	it("rejects a provided games array with 61 entries", () => {
		const games = Array.from({ length: 61 }, (_, i) => `v${i}`);
		expectRejects(appRouter.gameMix.update, { games, id: "mix-1" });
	});

	it("accepts a games array at the 60-entry boundary", () => {
		const games = Array.from({ length: 60 }, (_, i) => `v${i}`);
		expectAccepts(appRouter.gameMix.update, { games, id: "mix-1" });
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
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [],
		});
		await expectTrpcCode(
			caller.create({
				games: [OWNED_VARIANT_1.id, OTHER_VARIANT.id],
				label: "Brand New",
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
				games: [OWNED_VARIANT_1.id, "missing-id"],
				label: "Brand New",
			}),
			"FORBIDDEN"
		);
	});

	it("accepts a games array fully owned by the caller", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
			[MIX_TABLE]: [
				{
					id: "placeholder",
					label: "Placeholder",
					userId: CUR_OWNER,
				},
			],
		});
		await expect(
			caller.create({
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
				label: "Brand New",
			})
		).resolves.toBeDefined();
	});

	it("stores mix metadata and normalized rows atomically", async () => {
		const { caller, inserted, updated, selectWhereParams } = gameMixCaller(
			CUR_OWNER,
			{
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: [OWNED_VARIANT_1, OWNED_VARIANT_2],
				[MIX_TABLE]: [
					{
						id: "placeholder",
						label: "Placeholder",
						userId: CUR_OWNER,
					},
				],
			}
		);
		await caller.create({
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			label: "Brand New",
		});
		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).toMatchObject({
			builtinKey: null,
			label: "Brand New",
			userId: CUR_OWNER,
		});
		expect(inserted[MIX_TABLE]?.[0]).not.toHaveProperty("games");
		expect(
			typeof (inserted[MIX_TABLE]?.[0] as Record<string, unknown> | undefined)
				?.id
		).toBe("string");
		// biome-ignore lint/correctness/noUnsafeOptionalChaining: Preserve the failure if the expected inserted row is missing.
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
		expect(updated[MIX_TABLE]).toBeUndefined();
	});
});

describe("gameMix.update games ownership (SA2-183)", () => {
	it("rejects updating games to include a variant id owned by another user (FORBIDDEN)", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [{ id: "mix-1", label: "My Mix", userId: CUR_OWNER }],
		});
		await expectTrpcCode(
			caller.update({
				games: [OWNED_VARIANT_1.id, OTHER_VARIANT.id],
				id: "mix-1",
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
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_1.id],
				label: "Brand New",
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
			[MIX_TABLE]: [{ id: "mix-1", label: "My Mix", userId: CUR_OWNER }],
		});
		await expectTrpcCode(
			caller.update({
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_1.id],
				id: "mix-1",
			}),
			"BAD_REQUEST"
		);
	});
});

function variantsAcrossGroups(n: number): Rows {
	return Array.from({ length: n }, (_, i) => ({
		groupId: `grp-span-${i}`,
		id: `gv-span-${i}`,
		label: `Span Variant ${i}`,
		userId: CUR_OWNER,
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
				games: variants.map((v) => v.id as string),
				label: "Too Wide",
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
					label: "Placeholder",
					userId: CUR_OWNER,
				},
			],
		});
		await expect(
			caller.create({
				games: variants.map((v) => v.id as string),
				label: "Exactly 12",
			})
		).resolves.toBeDefined();
	});

	it("update rejects when the owned variants span 13 distinct game groups", async () => {
		const variants = variantsAcrossGroups(13);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [{ id: "mix-1", label: "My Mix", userId: CUR_OWNER }],
		});
		await expectTrpcCode(
			caller.update({
				games: variants.map((v) => v.id as string),
				id: "mix-1",
			}),
			"BAD_REQUEST"
		);
	});

	it("update accepts when the owned variants span exactly 12 distinct game groups (boundary)", async () => {
		const variants = variantsAcrossGroups(12);
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [{ id: "mix-1", label: "My Mix", userId: CUR_OWNER }],
		});
		await expect(
			caller.update({
				games: variants.map((v) => v.id as string),
				id: "mix-1",
			})
		).resolves.toBeDefined();
	});
});

describe("gameMix.list ordering + self-seed", () => {
	it("orders builtin mixes horse -> 8game -> 10game ahead of custom mixes", async () => {
		const { caller } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: [OWNED_VARIANT_1],
			[MIX_TABLE]: [
				{
					builtinKey: null,
					id: "custom-1",
					label: "Zeta Custom",
					userId: CUR_OWNER,
				},
				{
					builtinKey: "8game",
					id: "eight-1",
					label: "8-Game",
					userId: CUR_OWNER,
				},
				{
					builtinKey: null,
					id: "custom-2",
					label: "Alpha Custom",
					userId: CUR_OWNER,
				},
				{
					builtinKey: "10game",
					id: "ten-1",
					label: "10-Game",
					userId: CUR_OWNER,
				},
				{
					builtinKey: "horse",
					id: "horse-1",
					label: "HORSE",
					userId: CUR_OWNER,
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
			mix: [{ id: "mix-1", label: "X", userId: CUR_OWNER }],
		});
		const { caller, selectWhereParams } = gameMixCaller(CUR_OWNER, rows);
		await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
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
						builtinKey: "horse",
						id: "mix-a",
						label: "HORSE",
						userId: CUR_OWNER,
					},
					{
						builtinKey: null,
						id: "mix-b",
						label: "Custom",
						userId: CUR_OWNER,
					},
				],
				[MIX_VARIANT_TABLE]: [
					{
						mixId: "mix-a",
						position: 1,
						userId: CUR_OWNER,
						variantId: OWNED_VARIANT_1.id,
					},
					{
						mixId: "mix-b",
						position: 0,
						userId: CUR_OWNER,
						variantId: OWNED_VARIANT_1.id,
					},
					{
						mixId: "mix-a",
						position: 0,
						userId: CUR_OWNER,
						variantId: OWNED_VARIANT_2.id,
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
				{ builtinKey: null, id: "mix-a", label: "A", userId: CUR_OWNER },
				{ builtinKey: null, id: "mix-b", label: "B", userId: CUR_OWNER },
			],
			[MIX_VARIANT_TABLE]: [
				{
					mixId: "mix-a",
					position: 0,
					userId: CUR_OWNER,
					variantId: OWNED_VARIANT_1.id,
				},
			],
		});

		await caller.list();

		expect(selectWhereParams.at(-1)).toEqual([CUR_OWNER, "mix-a", "mix-b"]);
	});

	it("keeps the junction read owner-scoped only when the id list would overflow D1's bind cap", async () => {
		const mixes = Array.from({ length: 100 }, (_, index) => ({
			builtinKey: null,
			id: `mix-${index}`,
			label: `Mix ${index}`,
			userId: CUR_OWNER,
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
				{ builtinKey: null, id: "mix-1", label: "Renamed", userId: CUR_OWNER },
			],
			[MIX_VARIANT_TABLE]: [
				{
					mixId: "mix-1",
					position: 0,
					userId: CUR_OWNER,
					variantId: OWNED_VARIANT_1.id,
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

	it("creates a 30-game mix with normalized rows in one batch", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			groupId: OWNED_GROUP.id,
			id: `variant-${index}`,
			label: `Variant ${index}`,
			sortOrder: index,
			userId: CUR_OWNER,
		}));
		const games = variants.map((variant) => variant.id);
		const { caller, inserted, updated, batch } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [
				{
					id: "placeholder",
					label: "Placeholder",
					userId: CUR_OWNER,
				},
			],
			[MIX_VARIANT_TABLE]: games.map((variantId, position) => ({
				mixId: "placeholder",
				position,
				userId: CUR_OWNER,
				variantId,
			})),
		});

		const created = await caller.create({ games, label: "Thirty Game" });

		expect(inserted[MIX_TABLE]).toHaveLength(1);
		expect(inserted[MIX_TABLE]?.[0]).not.toHaveProperty("games");
		expect(updated[MIX_TABLE]).toBeUndefined();
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
		expect(batch.mock.calls[0]?.[0]).toHaveLength(6);
	});

	it("chunks membership inserts by the row's real column count, not a literal width", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			groupId: OWNED_GROUP.id,
			id: `variant-${index}`,
			label: `Variant ${index}`,
			sortOrder: index,
			userId: CUR_OWNER,
		}));
		const { caller, inserted } = gameMixCaller(CUR_OWNER, {
			[GROUP_TABLE]: [OWNED_GROUP],
			[VARIANT_TABLE]: variants,
			[MIX_TABLE]: [{ id: "placeholder", label: "P", userId: CUR_OWNER }],
			[MIX_VARIANT_TABLE]: [],
		});

		await caller.create({
			games: variants.map((variant) => variant.id),
			label: "Thirty Game",
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

	it("replaces a 30-game composition atomically", async () => {
		const variants = Array.from({ length: 30 }, (_, index) => ({
			groupId: OWNED_GROUP.id,
			id: `replacement-${index}`,
			label: `Replacement ${index}`,
			sortOrder: index,
			userId: CUR_OWNER,
		}));
		const games = variants.map((variant) => variant.id);
		const { caller, inserted, updated, batch, deleteWhereParams } =
			gameMixCaller(CUR_OWNER, {
				[GROUP_TABLE]: [OWNED_GROUP],
				[VARIANT_TABLE]: variants,
				[MIX_TABLE]: [
					{
						id: "mix-1",
						label: "My Mix",
						userId: CUR_OWNER,
					},
				],
				[MIX_VARIANT_TABLE]: games.map((variantId, position) => ({
					mixId: "mix-1",
					position,
					userId: CUR_OWNER,
					variantId,
				})),
			});

		const updatedMix = await caller.update({ games, id: "mix-1" });

		expect(updated[MIX_TABLE]).toHaveLength(1);
		expect(updated[MIX_TABLE]?.[0]).not.toHaveProperty("games");
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
		expect(batch.mock.calls[0]?.[0]).toHaveLength(8);
	});
});
