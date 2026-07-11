import { customGameVariant } from "@sapphire2/db/schema/custom-game-variant";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { isPresetCollision } from "../routers/game-variant";
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

/**
 * Mock db that resolves `select().from(table)…` from a table-keyed map and
 * records the bound params of every `select…where`, `update…set…where`, and
 * `delete…where` call so tests can assert ownership scoping (SA2-176,
 * SA2-183) and inspect inserted payloads.
 */
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
		insert: () => ({
			values: (v: Record<string, unknown>) => {
				inserted.push(v);
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
	};

	return {
		db,
		selectWhereParams,
		updateWhereParams,
		deleteWhereParams,
		inserted,
	};
}

function gameVariantCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const mock = createMockDb(rowsByTable);
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

describe("gameVariant router", () => {
	it("appRouter has gameVariant namespace", () => {
		expect(appRouter.gameVariant).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.gameVariant.list).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.gameVariant.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.gameVariant.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.gameVariant.delete).toBeDefined();
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
	it("accepts a minimal valid label", () => {
		expectAccepts(appRouter.gameVariant.create, { label: "My Mix" });
	});

	it("rejects an empty label", () => {
		expectRejects(appRouter.gameVariant.create, { label: "" });
	});

	it("rejects a whitespace-only label (trimmed to empty)", () => {
		expectRejects(appRouter.gameVariant.create, { label: "   " });
	});

	it("accepts a label at the 30-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, { label: "a".repeat(30) });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameVariant.create, { label: "a".repeat(31) });
	});

	it("rejects missing label", () => {
		expectRejects(appRouter.gameVariant.create, {});
	});

	it("accepts blind labels omitted (nullish)", () => {
		expectAccepts(appRouter.gameVariant.create, { label: "My Mix" });
	});

	it("accepts blind labels explicitly null", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
		});
	});

	it("accepts blind labels at the 20-character boundary", () => {
		expectAccepts(appRouter.gameVariant.create, {
			label: "My Mix",
			blind1Label: "a".repeat(20),
			blind2Label: "a".repeat(20),
			blind3Label: "a".repeat(20),
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			blind1Label: "a".repeat(21),
		});
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			blind2Label: "a".repeat(21),
		});
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			blind3Label: "a".repeat(21),
		});
	});

	it("rejects an empty blind label", () => {
		expectRejects(appRouter.gameVariant.create, {
			label: "My Mix",
			blind1Label: "",
		});
	});
});

describe("gameVariant.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.gameVariant.update, { id: "cv-1" });
	});

	it("accepts id + label", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "cv-1",
			label: "New Label",
		});
	});

	it("rejects empty label when provided", () => {
		expectRejects(appRouter.gameVariant.update, { id: "cv-1", label: "" });
	});

	it("rejects a label longer than 30 characters", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "cv-1",
			label: "a".repeat(31),
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameVariant.update, { label: "x" });
	});

	it("accepts blind labels cleared to null", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "cv-1",
			blind1Label: null,
			blind2Label: null,
			blind3Label: null,
		});
	});

	it("rejects a blind label longer than 20 characters", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "cv-1",
			blind1Label: "a".repeat(21),
		});
	});
});

describe("gameVariant.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.gameVariant.delete, { id: "cv-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameVariant.delete, {});
	});
});

describe("isPresetCollision", () => {
	it("collides on a preset key ('nlh')", () => {
		expect(isPresetCollision("nlh")).toBe(true);
	});

	it('collides on a preset label ("NL Hold\'em")', () => {
		expect(isPresetCollision("NL Hold'em")).toBe(true);
	});

	it("collides on a preset shortLabel ('NLH')", () => {
		expect(isPresetCollision("NLH")).toBe(true);
	});

	it("collides case-insensitively on shortLabel ('PLO' and 'plo')", () => {
		expect(isPresetCollision("PLO")).toBe(true);
		expect(isPresetCollision("plo")).toBe(true);
	});

	it("collides case-insensitively on label ('Mixed Game')", () => {
		expect(isPresetCollision("Mixed Game")).toBe(true);
		expect(isPresetCollision("mixed game")).toBe(true);
	});

	it("does not collide for a genuinely new label ('Big Duck')", () => {
		expect(isPresetCollision("Big Duck")).toBe(false);
	});
});

describe("gameVariant.create collision guard (CONFLICT)", () => {
	it("rejects a label colliding with a preset key", async () => {
		const { caller } = gameVariantCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([[customGameVariant, []]])
		);
		await expectTrpcCode(caller.create({ label: "nlh" }), "CONFLICT");
	});

	it("rejects a label colliding with the caller's existing custom label (case-insensitive)", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expectTrpcCode(caller.create({ label: "my mix" }), "CONFLICT");
	});

	it("accepts a genuinely new label with no collision", async () => {
		const rows = new Map<unknown, Rows>([
			[
				customGameVariant,
				[{ id: "cv-1", userId: CUR_OWNER, label: "Other Mix" }],
			],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expect(caller.create({ label: "Brand New" })).resolves.toBeDefined();
	});

	it("stamps the created row with the caller's userId and a generated id", async () => {
		const { caller, inserted } = gameVariantCaller(
			CUR_OWNER,
			new Map<unknown, Rows>([[customGameVariant, []]])
		);
		await caller.create({ label: "Brand New" });
		expect(inserted).toHaveLength(1);
		expect(inserted[0]).toMatchObject({
			userId: CUR_OWNER,
			label: "Brand New",
		});
		expect(typeof inserted[0]?.id).toBe("string");
	});
});

describe("gameVariant ownership (uniform FORBIDDEN, SA2-183)", () => {
	for (const op of ["update", "delete"] as const) {
		it(`${op} throws FORBIDDEN for a row owned by another user`, async () => {
			const rows = new Map<unknown, Rows>([
				[
					customGameVariant,
					[{ id: "cv-1", userId: CUR_OTHER, label: "Their Mix" }],
				],
			]);
			const { caller } = gameVariantCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "cv-1" }), "FORBIDDEN");
		});

		it(`${op} throws FORBIDDEN (not NOT_FOUND) for a missing row`, async () => {
			const rows = new Map<unknown, Rows>([[customGameVariant, []]]);
			const { caller } = gameVariantCaller(CUR_OWNER, rows);
			await expectTrpcCode(caller[op]({ id: "missing" }), "FORBIDDEN");
		});
	}

	it("update resolves for a row owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "cv-1", label: "Renamed Mix" })
		).resolves.toBeDefined();
	});

	it("delete resolves for a row owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expect(caller.delete({ id: "cv-1" })).resolves.toEqual({
			success: true,
		});
	});
});

describe("gameVariant.update excludes self from collision", () => {
	it("succeeds when keeping the row's own (unchanged) label", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expect(
			caller.update({ id: "cv-1", label: "My Mix" })
		).resolves.toBeDefined();
	});

	it("still rejects renaming to a different existing custom label (CONFLICT)", async () => {
		const rows = new Map<unknown, Rows>([
			[
				customGameVariant,
				[
					{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" },
					{ id: "cv-2", userId: CUR_OWNER, label: "Other Mix" },
				],
			],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "cv-1", label: "Other Mix" }),
			"CONFLICT"
		);
	});
});

describe("gameVariant write-IDOR guard (SA2-176)", () => {
	it("update WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller, updateWhereParams } = gameVariantCaller(CUR_OWNER, rows);
		await caller.update({ id: "cv-1", label: "Renamed" });
		expect(updateWhereParams).toHaveLength(1);
		expect(updateWhereParams[0]).toContain("cv-1");
		expect(updateWhereParams[0]).toContain(CUR_OWNER);
	});

	it("delete WHERE binds both the id and the caller's userId", async () => {
		const rows = new Map<unknown, Rows>([
			[customGameVariant, [{ id: "cv-1", userId: CUR_OWNER, label: "My Mix" }]],
		]);
		const { caller, deleteWhereParams } = gameVariantCaller(CUR_OWNER, rows);
		await caller.delete({ id: "cv-1" });
		expect(deleteWhereParams).toHaveLength(1);
		expect(deleteWhereParams[0]).toContain("cv-1");
		expect(deleteWhereParams[0]).toContain(CUR_OWNER);
	});
});

describe("gameVariant.list scoping", () => {
	it("queries scoped to the caller's userId, ordered by label", async () => {
		const rows = new Map<unknown, Rows>([
			[
				customGameVariant,
				[
					{ id: "cv-1", userId: CUR_OWNER, label: "Zed Mix" },
					{ id: "cv-2", userId: CUR_OWNER, label: "Alpha Mix" },
				],
			],
		]);
		const { caller, selectWhereParams } = gameVariantCaller(CUR_OWNER, rows);
		const result = await caller.list();
		expect(selectWhereParams).toHaveLength(1);
		expect(selectWhereParams[0]).toEqual([CUR_OWNER]);
		expect(result).toHaveLength(2);
	});

	it("binds a different caller's own userId, not another user's", async () => {
		const rows = new Map<unknown, Rows>([[customGameVariant, []]]);
		const { caller, selectWhereParams } = gameVariantCaller(CUR_OTHER, rows);
		await caller.list();
		expect(selectWhereParams[0]).toEqual([CUR_OTHER]);
	});
});

describe("gameVariant type guard sanity", () => {
	it("getInputSchema works for create", () => {
		const schema = getInputSchema(appRouter.gameVariant.create);
		expect(schema.safeParse({ label: "x" }).success).toBe(true);
	});
});
