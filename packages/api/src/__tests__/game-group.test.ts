import { gameGroup } from "@sapphire2/db/schema/game-group";
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

function gameGroupCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const mock = createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).gameGroup;
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

function seededRows(extra: { variant?: Rows; group?: Rows } = {}) {
	return new Map<unknown, Rows>([
		[gameGroup, extra.group ?? [{ id: "grp-1", userId: CUR_OWNER }]],
		[gameVariant, extra.variant ?? [{ id: "gv-1", userId: CUR_OWNER }]],
	]);
}

describe("gameGroup router", () => {
	it("appRouter has gameGroup namespace", () => {
		expect(appRouter.gameGroup).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameGroup).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.gameGroup.list);
		expectType(appRouter.gameGroup.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.gameGroup.create,
			appRouter.gameGroup.update,
			appRouter.gameGroup.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("gameGroup.create input validation", () => {
	it("accepts a minimal valid label", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "My Group" });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameGroup.create, { label: "" });
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameGroup.create, { label: "   " });
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "a".repeat(30) });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameGroup.create, { label: "a".repeat(31) });
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameGroup.create, {});
	});

	it("accepts blind labels omitted (nullish)", () => {
		expectAccepts(appRouter.gameGroup.create, { label: "My Group" });
	});

	it("accepts blind labels explicitly null", () => {
		expectAccepts(appRouter.gameGroup.create, {
			label: "My Group",
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
		});
	});

	it("accepts blind labels at the 20-character boundary", () => {
		expectAccepts(appRouter.gameGroup.create, {
			label: "My Group",
			blind1Label: "a".repeat(20),
			blind2Label: "a".repeat(20),
			blind3Label: "a".repeat(20),
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameGroup.create, {
			label: "My Group",
			blind1Label: "a".repeat(21),
		});
	});

	it("rejects an empty blind label", () => {
		expectRejects(appRouter.gameGroup.create, {
			label: "My Group",
			blind1Label: "",
		});
	});

	it("rejects a builtinKey supplied in the input (immutable, not settable)", () => {
		const schema = getInputSchema(appRouter.gameGroup.create);
		const parsed = schema.safeParse({
			label: "My Group",
			builtinKey: "limit",
		}) as unknown as { data?: Record<string, unknown>; success: boolean };
		expect(parsed.success).toBe(true);
		expect(parsed.data?.builtinKey).toBeUndefined();
	});
});

describe("gameGroup.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.gameGroup.update, { id: "grp-1" });
	});

	it("accepts id + label", () => {
		expectAccepts(appRouter.gameGroup.update, {
			id: "grp-1",
			label: "New Label",
		});
	});

	it("rejects empty label when provided", () => {
		expectRejects(appRouter.gameGroup.update, { id: "grp-1", label: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameGroup.update, { label: "x" });
	});

	it("accepts blind labels cleared to null", () => {
		expectAccepts(appRouter.gameGroup.update, {
			id: "grp-1",
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameGroup.update, {
			id: "grp-1",
			blind1Label: "a".repeat(21),
		});
	});

	it("strips a builtinKey supplied in the input (immutable)", () => {
		const schema = getInputSchema(appRouter.gameGroup.update);
		const parsed = schema.safeParse({
			id: "grp-1",
			builtinKey: "stud",
		}) as unknown as { data?: Record<string, unknown>; success: boolean };
		expect(parsed.success).toBe(true);
		expect(parsed.data?.builtinKey).toBeUndefined();
	});
});

describe("gameGroup.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.gameGroup.delete, { id: "grp-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameGroup.delete, {});
	});
});

describe("gameGroup.create collision guard (CONFLICT)", () => {
	it("rejects a label colliding with the caller's existing group label (case-insensitive)", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expectTrpcCode(caller.create({ label: "my group" }), "CONFLICT");
	});

	it("accepts a genuinely new label with no collision", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "Other Group" }]],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expect(caller.create({ label: "Brand New" })).resolves.toBeDefined();
	});

	it("stamps the created row with the caller's userId, null builtinKey, and a generated id", async () => {
		const { caller, inserted } = gameGroupCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([[gameGroup, []]])
		);
		await caller.create({ label: "Brand New" });
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
			builtinKey: null,
		});
		expect(typeof inserted[0]?.id).toBe("string");
	});
});

describe("gameGroup ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const rows = new Map<unknown, Rows>([
				[gameGroup, [{ id: "grp-1", userId: CUR_OTHER, label: "Their Group" }]],
				[gameVariant, []],
			]);
			const { caller } = gameGroupCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "grp-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const rows = new Map<unknown, Rows>([
				[gameGroup, []],
				[gameVariant, []],
			]);
			const { caller } = gameGroupCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update resolves for a row owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "grp-1", label: "Renamed Group" })
		).resolves.toBeDefined();
	});
});

describe("gameGroup.update excludes self from collision", () => {
	it("succeeds when keeping the row's own (unchanged) label", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "grp-1", label: "My Group" })
		).resolves.toBeDefined();
	});

	it("still rejects renaming to a different existing group label (CONFLICT)", async () => {
		const rows = new Map<unknown, Rows>([
			[
				gameGroup,
				[
					{ id: "grp-1", userId: CUR_OWNER, label: "My Group" },
					{ id: "grp-2", userId: CUR_OWNER, label: "Other Group" },
				],
			],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "grp-1", label: "Other Group" }),
			"CONFLICT"
		);
	});
});

describe("gameGroup write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
		]);
		const { caller, updateWhereParams } = gameGroupCaller(CUR_OWNER, rows);
		await caller.update({ id: "grp-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("grp-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
			[gameVariant, []],
		]);
		const { caller, deleteWhereParams } = gameGroupCaller(CUR_OWNER, rows);
		await caller.delete({ id: "grp-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("grp-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameGroup.delete in-use rejection (cascade-aware delete, SA2-165)", () => {
	it("rejects with CONFLICT when a variant references the group", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
			[
				gameVariant,
				[
					{
						id: "gv-1",
						userId: CUR_OWNER,
						groupId: "grp-1",
						label: "NL Hold'em",
					},
				],
			],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expectTrpcCode(caller.delete({ id: "grp-1" }), "CONFLICT");
	});

	it("succeeds when no variant references the group", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, [{ id: "grp-1", userId: CUR_OWNER, label: "My Group" }]],
			[gameVariant, []],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		await expect(caller.delete({ id: "grp-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameGroup.list ordering + self-seed", () => {
	it("orders builtin groups limit -> stud -> bigbet ahead of custom groups", async () => {
		const rows = new Map<unknown, Rows>([
			[
				gameGroup,
				[
					{
						id: "custom-1",
						userId: CUR_OWNER,
						builtinKey: null,
						label: "Zeta Custom",
					},
					{
						id: "bigbet-1",
						userId: CUR_OWNER,
						builtinKey: "bigbet",
						label: "Big Bet",
					},
					{
						id: "custom-2",
						userId: CUR_OWNER,
						builtinKey: null,
						label: "Alpha Custom",
					},
					{
						id: "stud-1",
						userId: CUR_OWNER,
						builtinKey: "stud",
						label: "Stud",
					},
					{
						id: "limit-1",
						userId: CUR_OWNER,
						builtinKey: "limit",
						label: "Limit",
					},
				],
			],
			[gameVariant, [{ id: "gv-1", userId: CUR_OWNER }]],
		]);
		const { caller } = gameGroupCaller(CUR_OWNER, rows);
		const result = (await caller.list()) as { id: string }[];
		expect(result.map((r) => r.id)).toEqual([
			"limit-1",
			"stud-1",
			"bigbet-1",
			"custom-2",
			"custom-1",
		]);
	});

	it("self-seeds when the caller has zero groups and zero variants", async () => {
		const rows = new Map<unknown, Rows>([
			[gameGroup, []],
			[gameVariant, []],
		]);
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, rows);
		await caller.list();
		const groupInserts = inserted.filter(
			(r) => r.builtinKey !== undefined && r.groupId === undefined
		);
		const variantInserts = inserted.filter((r) => r.groupId !== undefined);
		expect(groupInserts).toHaveLength(3);
		expect(variantInserts).toHaveLength(21);
	});

	it("does not re-seed when the caller already has a group", async () => {
		const rows = seededRows();
		const { caller, inserted } = gameGroupCaller(CUR_OWNER, rows);
		await caller.list();
		expect(inserted).toHaveLength(0);
	});

	it("scopes the list query to the caller's userId", async () => {
		const rows = seededRows({
			group: [{ id: "grp-1", userId: CUR_OWNER, builtinKey: null, label: "X" }],
		});
		const { caller, selectWhereParams } = gameGroupCaller(CUR_OWNER, rows);
		await caller.list();
		expect(selectWhereParams).toContainEqual([CUR_OWNER]);
	});
});
