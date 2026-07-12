import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];
const dialect = new SQLiteSyncDialect();

function boundParams(cond: unknown): unknown[] {
	return dialect.sqlToQuery(cond as never).params;
}

/** Mirrors the mock db in game-variant.test.ts (see its doc comment). */
function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const selectWhereParams: unknown[][] = [];
	const updateWhereParams: unknown[][] = [];
	const deleteWhereParams: unknown[][] = [];
	const inserted: Record<string, unknown>[] = [];

	const makeSelectChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) =>
			makeSelectChain(rowsByTable.get(table) ?? []);
		chain.where = (cond: unknown) => {
			selectWhereParams.push(boundParams(cond));
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		return chain;
	};

	const db = {
		select: () => makeSelectChain([]),
		insert: (table: unknown) => ({
			values: (v: Record<string, unknown>) => {
				inserted.push({ ...v, __table: table });
				return Promise.resolve(undefined);
			},
		}),
		update: () => ({
			set: () => ({
				where: (cond: unknown) => {
					updateWhereParams.push(boundParams(cond));
					return Promise.resolve(undefined);
				},
			}),
		}),
		delete: () => ({
			where: (cond: unknown) => {
				deleteWhereParams.push(boundParams(cond));
				return Promise.resolve(undefined);
			},
		}),
		batch: (statements: unknown[]) =>
			Promise.all(statements as Promise<unknown>[]),
	};

	return {
		db,
		selectWhereParams,
		updateWhereParams,
		deleteWhereParams,
		inserted,
	};
}

function gameMixCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const mock = createMockDb(rowsByTable);
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

/** Non-empty group/variant/mix maps so list()'s self-seed guard is skipped. */
function seededRows(extra: { variant?: Rows; group?: Rows; mix?: Rows } = {}) {
	return new Map<unknown, Rows>([
		[gameGroup, extra.group ?? [OWNED_GROUP]],
		[gameVariant, extra.variant ?? [OWNED_VARIANT_1]],
		[
			gameMix,
			extra.mix ?? [{ id: "mix-1", userId: CUR_OWNER, label: "X", games: [] }],
		],
	]);
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
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			// Simulates the filtered `WHERE id IN (…) AND userId = caller` query
			// returning only the caller-owned row (see the mock's doc comment).
			[gameVariant, [OWNED_VARIANT_1]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, OTHER_VARIANT.id],
			}),
			"FORBIDDEN"
		);
	});

	it("rejects a games array containing a nonexistent variant id (FORBIDDEN, not NOT_FOUND)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, "missing-id"],
			}),
			"FORBIDDEN"
		);
	});

	it("accepts a games array fully owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			// A dummy pre-existing row so the mock's post-insert lookup (which
			// does not actually filter by the fresh id) resolves to something
			// truthy (mirrors game-variant.test.ts's "placeholder" convention).
			[
				gameMix,
				[
					{
						id: "placeholder",
						userId: CUR_OWNER,
						label: "Placeholder",
						games: [],
					},
				],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expect(
			caller.create({
				label: "Brand New",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			})
		).resolves.toBeDefined();
	});

	it("stamps the created row with the caller's userId, null builtinKey, a generated id, and the ordered games array", async () => {
		const { caller, inserted } = gameMixCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([
				[gameGroup, [OWNED_GROUP]],
				[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
				[
					gameMix,
					[
						{
							id: "placeholder",
							userId: CUR_OWNER,
							label: "Placeholder",
							games: [],
						},
					],
				],
			])
		);
		await caller.create({
			label: "Brand New",
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			builtinKey: null,
			games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
		});
		expect(typeof inserted[0]?.id).toBe("string");
	});
});

describe("gameMix.update games ownership (SA2-183)", () => {
	it("rejects updating games to include a variant id owned by another user (FORBIDDEN)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
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
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
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
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.update({
				id: "mix-1",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_1.id],
			}),
			"BAD_REQUEST"
		);
	});
});

describe("gameMix.create collision guard (CONFLICT)", () => {
	it("rejects the reserved key 'mix' (case-insensitive)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
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
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.create({
				label: "mixed game",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("rejects a label colliding with the caller's existing mix label (case-insensitive)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.create({
				label: "my mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("rejects a label colliding with the caller's existing variant label (case-insensitive, cross-namespace)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			[gameMix, []],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.create({
				label: "nl hold'em",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			}),
			"CONFLICT"
		);
	});

	it("accepts a genuinely new label with no collision", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1, OWNED_VARIANT_2]],
			[
				gameMix,
				[
					{
						id: "placeholder",
						userId: CUR_OWNER,
						label: "Placeholder",
						games: [],
					},
				],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expect(
			caller.create({
				label: "Brand New Mix",
				games: [OWNED_VARIANT_1.id, OWNED_VARIANT_2.id],
			})
		).resolves.toBeDefined();
	});
});

describe("gameMix ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const rows = new Map<unknown, Rows>([
				[gameGroup, [OWNED_GROUP]],
				[gameVariant, [OWNED_VARIANT_1]],
				[
					gameMix,
					[{ id: "mix-1", userId: CUR_OTHER, label: "Their Mix", games: [] }],
				],
			]);
			const { caller } = gameMixCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "mix-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const rows = new Map<unknown, Rows>([
				[gameGroup, [OWNED_GROUP]],
				[gameVariant, [OWNED_VARIANT_1]],
				[gameMix, []],
			]);
			const { caller } = gameMixCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update resolves for a row owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "mix-1", label: "Renamed Mix" })
		).resolves.toBeDefined();
	});

	it("delete resolves for a row owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expect(caller.delete({ id: "mix-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameMix.update excludes self from collision", () => {
	it("succeeds when keeping the row's own (unchanged) label", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "mix-1", label: "My Mix" })
		).resolves.toBeDefined();
	});

	it("still rejects renaming to a different existing mix label (CONFLICT)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[
					{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] },
					{ id: "mix-2", userId: CUR_OWNER, label: "Other Mix", games: [] },
				],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "mix-1", label: "Other Mix" }),
			"CONFLICT"
		);
	});

	it("still rejects renaming to an existing variant label (CONFLICT, cross-namespace)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "mix-1", label: "NL Hold'em" }),
			"CONFLICT"
		);
	});
});

describe("gameMix write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller, updateWhereParams } = gameMixCaller(CUR_OWNER, rows);
		await caller.update({ id: "mix-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("mix-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[{ id: "mix-1", userId: CUR_OWNER, label: "My Mix", games: [] }],
			],
		]);
		const { caller, deleteWhereParams } = gameMixCaller(CUR_OWNER, rows);
		await caller.delete({ id: "mix-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("mix-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameMix.list ordering + self-seed", () => {
	it("orders builtin mixes horse -> 8game -> 10game ahead of custom mixes", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [OWNED_GROUP]],
			[gameVariant, [OWNED_VARIANT_1]],
			[
				gameMix,
				[
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
			],
		]);
		const { caller } = gameMixCaller(CUR_OWNER, rows);
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
		const rows = new Map<unknown, Rows>([
			[gameGroup, []],
			[gameVariant, []],
		]);
		const { caller, inserted } = gameMixCaller(CUR_OWNER, rows);
		await caller.list();
		const groupInserts = inserted.filter(
			(r) =>
				r.builtinKey !== undefined &&
				r.groupId === undefined &&
				r.games === undefined
		);
		const variantInserts = inserted.filter((r) => r.groupId !== undefined);
		const mixInserts = inserted.filter((r) => Array.isArray(r.games));
		expect(groupInserts).toHaveLength(3);
		expect(variantInserts).toHaveLength(21);
		expect(mixInserts).toHaveLength(3);
	});

	it("does not re-seed when the caller already has a group", async () => {
		const rows = seededRows();
		const { caller, inserted } = gameMixCaller(CUR_OWNER, rows);
		await caller.list();
		expect(inserted).toHaveLength(0);
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
