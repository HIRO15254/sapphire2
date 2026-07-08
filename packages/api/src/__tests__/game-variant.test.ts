import { DEFAULT_GAME_VARIANTS } from "@sapphire2/db/constants";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
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

interface Stmt {
	kind: "delete" | "insert" | "update";
	table: unknown;
	values?: unknown;
}

/** Indexed access with a runtime bounds check (repo tsconfig sets `noUncheckedIndexedAccess`). */
function at<T>(arr: readonly T[], index: number): T {
	const value = arr[index];
	if (value === undefined) {
		throw new Error(`expected an element at index ${index}`);
	}
	return value;
}

/**
 * A drizzle-shaped mock db mirroring the local mocks in ring-game.test.ts /
 * db-batch-atomicity.test.ts: `select().from(table)` resolves to the rows
 * pre-configured for that table reference (WHERE conditions are not
 * evaluated — scenarios are set up by choosing which rows to configure), and
 * insert/update/delete calls record inert descriptor objects so `db.batch`
 * payloads and individual mutations can be asserted on directly.
 */
function createMockDb(rowsByTable: Map<unknown, Rows> = new Map()) {
	const inserted: Stmt[] = [];
	const updated: Stmt[] = [];
	const deleted: Stmt[] = [];
	const batchCalls: Stmt[][] = [];
	let onConflictCalls = 0;

	const makeSelectChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) =>
			makeSelectChain(rowsByTable.get(table) ?? []);
		chain.where = () => chain;
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		return chain;
	};

	const db = {
		select: () => makeSelectChain([]),
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				const stmt: Stmt = { kind: "insert", table, values };
				inserted.push(stmt);
				const promise = Promise.resolve(stmt) as Promise<Stmt> &
					Record<string, (...args: unknown[]) => unknown>;
				promise.onConflictDoNothing = () => {
					onConflictCalls += 1;
					return stmt;
				};
				return promise;
			},
		}),
		update: (table: unknown) => ({
			set: (values: unknown) => ({
				where: () => {
					const stmt: Stmt = { kind: "update", table, values };
					updated.push(stmt);
					return stmt;
				},
			}),
		}),
		delete: (table: unknown) => ({
			where: () => {
				const stmt: Stmt = { kind: "delete", table };
				deleted.push(stmt);
				return stmt;
			},
		}),
		batch: (stmts: Stmt[]) => {
			batchCalls.push([...stmts]);
			return Promise.resolve(stmts);
		},
	};

	return {
		db,
		inserted,
		updated,
		deleted,
		batchCalls,
		getOnConflictCalls: () => onConflictCalls,
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

	it("has archive procedure", () => {
		expect(appRouter.gameVariant.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.gameVariant.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.gameVariant.delete).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.gameVariant).sort()).toEqual(
			["archive", "create", "delete", "list", "restore", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.gameVariant.list);
		expectType(appRouter.gameVariant.list, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
		] as const) {
			const proc = appRouter.gameVariant[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("gameVariant.list input validation", () => {
	it("accepts undefined input (all-optional)", () => {
		const schema = getInputSchema(appRouter.gameVariant.list);
		expect(schema.safeParse(undefined).success).toBe(true);
	});

	it("accepts an empty object", () => {
		expectAccepts(appRouter.gameVariant.list, {});
	});

	it("accepts includeArchived: true/false", () => {
		expectAccepts(appRouter.gameVariant.list, { includeArchived: true });
		expectAccepts(appRouter.gameVariant.list, { includeArchived: false });
	});

	it("rejects non-boolean includeArchived", () => {
		expectRejects(appRouter.gameVariant.list, { includeArchived: "yes" });
	});
});

describe("gameVariant.create input validation", () => {
	it("rejects empty name", () => {
		expectRejects(appRouter.gameVariant.create, { name: "" });
	});

	it("rejects a whitespace-only name (trims to empty)", () => {
		expectRejects(appRouter.gameVariant.create, { name: "   " });
	});

	it("rejects a 51-character name", () => {
		expectRejects(appRouter.gameVariant.create, { name: "a".repeat(51) });
	});

	it("accepts a 50-character name", () => {
		expectAccepts(appRouter.gameVariant.create, { name: "a".repeat(50) });
	});

	it("trims a padded name", () => {
		const schema = getInputSchema(appRouter.gameVariant.create);
		const parsed = schema.safeParse({ name: "  PLO5  " }) as unknown as {
			success: true;
			data: { name: string };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.name).toBe("PLO5");
	});

	it("accepts a payload with no blind labels", () => {
		expectAccepts(appRouter.gameVariant.create, { name: "Mixed" });
	});

	it("accepts blindLabel1/2/3 set to null", () => {
		expectAccepts(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel1: null,
			blindLabel2: null,
			blindLabel3: null,
		});
	});

	it("rejects an empty-string blind label", () => {
		expectRejects(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel1: "",
		});
	});

	it("rejects a 21-character blind label", () => {
		expectRejects(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel1: "a".repeat(21),
		});
	});

	it("accepts a 20-character blind label", () => {
		expectAccepts(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel1: "a".repeat(20),
		});
	});

	it("accepts blindLabel2 and blindLabel3 independently", () => {
		expectAccepts(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel2: "BB",
		});
		expectAccepts(appRouter.gameVariant.create, {
			name: "Mixed",
			blindLabel3: "Straddle",
		});
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.gameVariant.create, {});
	});
});

describe("gameVariant.update input validation", () => {
	it("accepts an id-only payload", () => {
		expectAccepts(appRouter.gameVariant.update, { id: "gv-1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.gameVariant.update, { name: "x" });
	});

	it("rejects an empty name when provided", () => {
		expectRejects(appRouter.gameVariant.update, { id: "gv-1", name: "" });
	});

	it("rejects a 51-character name", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			name: "a".repeat(51),
		});
	});

	it("accepts nullable blind labels set to null", () => {
		expectAccepts(appRouter.gameVariant.update, {
			id: "gv-1",
			blindLabel1: null,
			blindLabel2: null,
			blindLabel3: null,
		});
	});

	it("rejects a 21-character blind label", () => {
		expectRejects(appRouter.gameVariant.update, {
			id: "gv-1",
			blindLabel1: "a".repeat(21),
		});
	});
});

describe("gameVariant.{archive,restore,delete} input validation", () => {
	it("archive accepts {id}", () => {
		expectAccepts(appRouter.gameVariant.archive, { id: "gv-1" });
	});

	it("restore accepts {id}", () => {
		expectAccepts(appRouter.gameVariant.restore, { id: "gv-1" });
	});

	it("delete accepts {id}", () => {
		expectAccepts(appRouter.gameVariant.delete, { id: "gv-1" });
	});

	it("archive / restore / delete reject missing id", () => {
		expectRejects(appRouter.gameVariant.archive, {});
		expectRejects(appRouter.gameVariant.restore, {});
		expectRejects(appRouter.gameVariant.delete, {});
	});
});

describe("gameVariant.list lazy seeding", () => {
	it("inserts exactly 11 default rows with sortOrder 0..10 when the user has zero rows", async () => {
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, []]]);
		const { caller, inserted, getOnConflictCalls } = gameVariantCaller(
			CUR_OWNER,
			rowsByTable
		);

		await caller.list();

		expect(inserted).toHaveLength(1);
		const seedRows = at(inserted, 0).values as Record<string, unknown>[];
		expect(seedRows).toHaveLength(11);
		expect(seedRows.map((r) => r.sortOrder)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
		]);
		expect(seedRows.map((r) => r.name)).toEqual(
			DEFAULT_GAME_VARIANTS.map((v) => v.name)
		);
		for (const [index, row] of seedRows.entries()) {
			expect(row.userId).toBe(CUR_OWNER);
			expect(typeof row.id).toBe("string");
			expect((row.id as string).length).toBeGreaterThan(0);
			const expected = at(DEFAULT_GAME_VARIANTS, index);
			expect(row.blindLabel1).toBe(expected.blindLabel1);
			expect(row.blindLabel2).toBe(expected.blindLabel2);
			expect(row.blindLabel3).toBe(expected.blindLabel3);
		}
		expect(getOnConflictCalls()).toBe(1);
	});

	it("does not insert when the user already has rows (archived included)", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[
				gameVariant,
				[
					{
						id: "gv-1",
						userId: CUR_OWNER,
						name: "NLH",
						sortOrder: 0,
						archivedAt: new Date(),
					},
				],
			],
		]);
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await caller.list();

		expect(inserted).toHaveLength(0);
	});
});

describe("gameVariant.list archived filtering and ordering", () => {
	function rows(): Rows {
		return [
			{
				id: "gv-b",
				userId: CUR_OWNER,
				name: "Badugi",
				sortOrder: 1,
				archivedAt: null,
			},
			{
				id: "gv-a",
				userId: CUR_OWNER,
				name: "Archived",
				sortOrder: 1,
				archivedAt: new Date(),
			},
			{
				id: "gv-mixed",
				userId: CUR_OWNER,
				name: "Mixed",
				sortOrder: 0,
				archivedAt: null,
			},
		];
	}

	it("excludes archived rows by default", async () => {
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, rows()]]);
		const { caller } = gameVariantCaller(CUR_OWNER, rowsByTable);

		const result = (await caller.list()) as { id: string }[];

		expect(result.map((r) => r.id)).toEqual(["gv-mixed", "gv-b"]);
	});

	it("includes archived rows when includeArchived is true", async () => {
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, rows()]]);
		const { caller } = gameVariantCaller(CUR_OWNER, rowsByTable);

		const result = (await caller.list({ includeArchived: true })) as {
			id: string;
		}[];

		expect(result.map((r) => r.id)).toEqual(["gv-mixed", "gv-a", "gv-b"]);
	});

	it("orders by sortOrder asc then name asc", async () => {
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, rows()]]);
		const { caller } = gameVariantCaller(CUR_OWNER, rowsByTable);

		const result = (await caller.list()) as { sortOrder: number }[];

		expect(result.map((r) => r.sortOrder)).toEqual([0, 1]);
	});
});

describe("gameVariant.create", () => {
	it("rejects a duplicate name for the same user with CONFLICT", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[gameVariant, [{ id: "gv-1", userId: CUR_OWNER, name: "NLH" }]],
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await expectTrpcCode(caller.create({ name: "NLH" }), "CONFLICT");
	});

	it("allows the same name for a different user", async () => {
		// The duplicate check is scoped to the caller's own rows via
		// `WHERE user_id = ?`; a same-named row owned by another user never
		// enters this result set, so the mock is configured the same way a real
		// scoped SELECT would come back — empty. The mock's `select` doesn't
		// reflect inserts, so assert on the recorded insert payload rather than
		// the (unreachable, always-undefined-here) return value.
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, []]]);
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await caller.create({ name: "NLH" });
		expect(inserted).toHaveLength(1);
		expect(at(inserted, 0).values).toMatchObject({ name: "NLH" });
	});

	it("sets sortOrder to the current row count", async () => {
		const rowsByTable = new Map<unknown, Rows>([
			[
				gameVariant,
				[
					{ id: "gv-1", userId: CUR_OWNER, name: "NLH" },
					{ id: "gv-2", userId: CUR_OWNER, name: "PLO" },
				],
			],
		]);
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await caller.create({ name: "PLO5" });

		expect(inserted).toHaveLength(1);
		expect(at(inserted, 0).values).toMatchObject({
			userId: CUR_OWNER,
			name: "PLO5",
			sortOrder: 2,
			blindLabel1: null,
			blindLabel2: null,
			blindLabel3: null,
		});
	});

	it("stores provided blind labels", async () => {
		const rowsByTable = new Map<unknown, Rows>([[gameVariant, []]]);
		const { caller, inserted } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await caller.create({
			name: "Short Deck",
			blindLabel1: "Button blind",
		});

		expect(at(inserted, 0).values).toMatchObject({
			blindLabel1: "Button blind",
			blindLabel2: null,
			blindLabel3: null,
		});
	});
});

describe("gameVariant.update ownership", () => {
	function rowsFor(row: Record<string, unknown> | null): Map<unknown, Rows> {
		return new Map<unknown, Rows>([[gameVariant, row ? [row] : []]]);
	}

	it("throws NOT_FOUND when the row does not exist", async () => {
		const { caller } = gameVariantCaller(CUR_OWNER, rowsFor(null));
		await expectTrpcCode(caller.update({ id: "missing" }), "NOT_FOUND");
	});

	it("throws NOT_FOUND for a row owned by another user", async () => {
		const { caller } = gameVariantCaller(
			CUR_OWNER,
			rowsFor({ id: "gv-1", userId: CUR_OTHER, name: "NLH" })
		);
		await expectTrpcCode(caller.update({ id: "gv-1" }), "NOT_FOUND");
	});

	it("resolves for a row owned by the caller", async () => {
		const { caller } = gameVariantCaller(
			CUR_OWNER,
			rowsFor({ id: "gv-1", userId: CUR_OWNER, name: "NLH" })
		);
		await expect(
			caller.update({ id: "gv-1", blindLabel1: "SB" })
		).resolves.toBeDefined();
	});
});

describe("gameVariant.update rename", () => {
	function rowsByTableFor(
		gameVariantRows: Rows,
		extra: Partial<Record<"ringGame" | "tournament", Rows>> = {}
	): Map<unknown, Rows> {
		return new Map<unknown, Rows>([
			[gameVariant, gameVariantRows],
			[ringGame, extra.ringGame ?? []],
			[tournament, extra.tournament ?? []],
		]);
	}

	it("rejects a rename that collides with another variant of the same user", async () => {
		const rowsByTable = rowsByTableFor([
			{ id: "gv-1", userId: CUR_OWNER, name: "NLH" },
			{ id: "gv-2", userId: CUR_OWNER, name: "PLO" },
		]);
		const { caller } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await expectTrpcCode(
			caller.update({ id: "gv-1", name: "PLO" }),
			"CONFLICT"
		);
	});

	it("allows renaming to its own current name (no-op) without a duplicate conflict", async () => {
		const rowsByTable = rowsByTableFor([
			{ id: "gv-1", userId: CUR_OWNER, name: "NLH" },
		]);
		const { caller, batchCalls, updated } = gameVariantCaller(
			CUR_OWNER,
			rowsByTable
		);

		await expect(
			caller.update({ id: "gv-1", name: "NLH" })
		).resolves.toBeDefined();

		expect(batchCalls).toHaveLength(0);
		expect(updated).toHaveLength(1);
		expect(at(updated, 0).table).toBe(gameVariant);
	});

	it("issues a single non-batched update when the name is unchanged", async () => {
		const rowsByTable = rowsByTableFor([
			{ id: "gv-1", userId: CUR_OWNER, name: "NLH" },
		]);
		const { caller, batchCalls, updated } = gameVariantCaller(
			CUR_OWNER,
			rowsByTable
		);

		await caller.update({ id: "gv-1", blindLabel1: "New SB" });

		expect(batchCalls).toHaveLength(0);
		expect(updated).toHaveLength(1);
		const soleUpdate = at(updated, 0);
		expect(soleUpdate).toMatchObject({ kind: "update", table: gameVariant });
		expect(soleUpdate.values).toMatchObject({ blindLabel1: "New SB" });
	});

	it("issues a 3-statement batch atomically updating game_variant, ring_game, and tournament when the name changes", async () => {
		const rowsByTable = rowsByTableFor([
			{ id: "gv-1", userId: CUR_OWNER, name: "NLH" },
		]);
		const { caller, batchCalls } = gameVariantCaller(CUR_OWNER, rowsByTable);

		await caller.update({ id: "gv-1", name: "PLO5" });

		expect(batchCalls).toHaveLength(1);
		const batch = at(batchCalls, 0);
		expect(batch).toHaveLength(3);

		const [variantStmt, ringGameStmt, tournamentStmt] = [
			at(batch, 0),
			at(batch, 1),
			at(batch, 2),
		];
		expect(variantStmt).toMatchObject({ kind: "update", table: gameVariant });
		expect(variantStmt.values).toMatchObject({ name: "PLO5" });

		expect(ringGameStmt).toMatchObject({ kind: "update", table: ringGame });
		expect(ringGameStmt.values).toEqual({ variant: "PLO5" });

		expect(tournamentStmt).toMatchObject({
			kind: "update",
			table: tournament,
		});
		expect(tournamentStmt.values).toEqual({ variant: "PLO5" });
	});
});

describe("gameVariant.archive/restore/delete", () => {
	function rowsFor(row: Record<string, unknown> | null): Map<unknown, Rows> {
		return new Map<unknown, Rows>([[gameVariant, row ? [row] : []]]);
	}

	for (const op of ["archive", "restore", "delete"] as const) {
		it(`${op} resolves for a row owned by the caller`, async () => {
			const { caller } = gameVariantCaller(
				CUR_OWNER,
				rowsFor({ id: "gv-1", userId: CUR_OWNER, name: "NLH" })
			);
			await expect(caller[op]({ id: "gv-1" })).resolves.toBeDefined();
		});

		it(`${op} throws NOT_FOUND for a row owned by another user`, async () => {
			const { caller } = gameVariantCaller(
				CUR_OWNER,
				rowsFor({ id: "gv-1", userId: CUR_OTHER, name: "NLH" })
			);
			await expectTrpcCode(caller[op]({ id: "gv-1" }), "NOT_FOUND");
		});

		it(`${op} throws NOT_FOUND when the row does not exist`, async () => {
			const { caller } = gameVariantCaller(CUR_OWNER, rowsFor(null));
			await expectTrpcCode(caller[op]({ id: "missing" }), "NOT_FOUND");
		});
	}

	it("archive sets archivedAt and updatedAt on the game_variant row", async () => {
		const { caller, updated } = gameVariantCaller(
			CUR_OWNER,
			rowsFor({ id: "gv-1", userId: CUR_OWNER, name: "NLH" })
		);

		await caller.archive({ id: "gv-1" });

		expect(updated).toHaveLength(1);
		const archiveStmt = at(updated, 0);
		const values = archiveStmt.values as {
			archivedAt: Date;
			updatedAt: Date;
		};
		expect(archiveStmt.table).toBe(gameVariant);
		expect(values.archivedAt).toBeInstanceOf(Date);
		expect(values.updatedAt).toBeInstanceOf(Date);
	});

	it("restore clears archivedAt on the game_variant row", async () => {
		const { caller, updated } = gameVariantCaller(
			CUR_OWNER,
			rowsFor({
				id: "gv-1",
				userId: CUR_OWNER,
				name: "NLH",
				archivedAt: new Date(),
			})
		);

		await caller.restore({ id: "gv-1" });

		expect(updated).toHaveLength(1);
		const restoreStmt = at(updated, 0);
		expect(restoreStmt.table).toBe(gameVariant);
		expect(restoreStmt.values).toMatchObject({ archivedAt: null });
	});

	it("delete removes the game_variant row (masters rely on FK set-null)", async () => {
		const { caller, deleted } = gameVariantCaller(
			CUR_OWNER,
			rowsFor({ id: "gv-1", userId: CUR_OWNER, name: "NLH" })
		);

		const result = await caller.delete({ id: "gv-1" });

		expect(result).toEqual({ success: true });
		expect(deleted).toHaveLength(1);
		expect(at(deleted, 0).table).toBe(gameVariant);
	});
});
