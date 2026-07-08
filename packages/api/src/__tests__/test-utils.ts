import { getTableName } from "drizzle-orm";
import { expect, vi } from "vitest";

interface ZodLikeSchema {
	safeParse: (value: unknown) => { success: boolean };
}

interface ProcedureDef {
	inputs: unknown[];
	middlewares: unknown[];
	type: "mutation" | "query" | "subscription";
}

/**
 * Shape of a tRPC v11 procedure (as observed at runtime):
 *   procedure._def.inputs:      Zod schema array (first element is the top-level schema)
 *   procedure._def.middlewares: Middleware chain (protected procedures have 2+ entries)
 *   procedure._def.type:        "mutation" | "query" | "subscription"
 *
 * These helpers keep every router test file concise and consistent.
 */

export function getProcedureDef(procedure: unknown): ProcedureDef {
	const def = (procedure as { _def?: ProcedureDef })?._def;
	if (!def) {
		throw new Error("procedure has no _def; is it really a tRPC procedure?");
	}
	return def;
}

export function getInputSchema(procedure: unknown): ZodLikeSchema {
	const def = getProcedureDef(procedure);
	const candidate = def.inputs[0];
	if (
		!candidate ||
		typeof (candidate as ZodLikeSchema).safeParse !== "function"
	) {
		throw new Error("procedure has no Zod input schema at _def.inputs[0]");
	}
	return candidate as ZodLikeSchema;
}

export function expectAccepts(procedure: unknown, input: unknown): void {
	const schema = getInputSchema(procedure);
	const result = schema.safeParse(input);
	if (!result.success) {
		throw new Error(
			`Expected schema to accept input but it rejected: ${JSON.stringify(input)}`
		);
	}
	expect(result.success).toBe(true);
}

export function expectRejects(procedure: unknown, input: unknown): void {
	const schema = getInputSchema(procedure);
	const result = schema.safeParse(input);
	if (result.success) {
		throw new Error(
			`Expected schema to reject input but it accepted: ${JSON.stringify(input)}`
		);
	}
	expect(result.success).toBe(false);
}

export function expectProtected(procedure: unknown): void {
	const def = getProcedureDef(procedure);
	// A protected procedure has the base resolver + the protection middleware
	// (plus an input/query/mutation middleware). Public procedures have exactly 1.
	expect(def.middlewares.length).toBeGreaterThanOrEqual(2);
}

export function expectType(
	procedure: unknown,
	type: "mutation" | "query" | "subscription"
): void {
	expect(getProcedureDef(procedure).type).toBe(type);
}

type MockRow = Record<string, unknown>;

interface ChainableMockDbConfig {
	/** Rows returned by `select().from(table)…` keyed by the SQL table name. */
	select?: Record<string, MockRow[]>;
}

/**
 * A minimal chainable Drizzle-style mock `db` for exercising router
 * procedures / helpers end-to-end without a real database.
 *
 * `select()` chains (`.from().where().limit().orderBy()`) resolve to the rows
 * configured for the table passed to `.from(table)` (matched via
 * `getTableName`); `insert(table).values(rows)` records the inserted payload.
 * It tracks which tables were read (`selectedTables`) so ownership guards can
 * be asserted, and which tables were written (`inserted`).
 */
export function createChainableMockDb(config: ChainableMockDbConfig = {}) {
	const selectRows = config.select ?? {};
	const inserted: Record<string, unknown[]> = {};
	const selectedTables: string[] = [];

	// The chain is a real Promise (so `await`-ing any step resolves the rows
	// natively) with Drizzle's builder methods attached. Non-terminal steps
	// (`where` / `limit` / `orderBy` / joins) return the same promise; `from`
	// starts a fresh chain scoped to the table's configured rows.
	function makeSelectChain(rows: MockRow[]) {
		const chain = Promise.resolve(rows) as Promise<MockRow[]> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => {
			const name = getTableName(table as never);
			selectedTables.push(name);
			return makeSelectChain(selectRows[name] ?? []);
		};
		chain.where = () => chain;
		chain.limit = () => chain;
		chain.orderBy = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		return chain;
	}

	const select = vi.fn(() => makeSelectChain([]));
	const insert = vi.fn((table: unknown) => ({
		values: vi.fn((values: unknown) => {
			const name = getTableName(table as never);
			const bucket = inserted[name] ?? [];
			bucket.push(values);
			inserted[name] = bucket;
			return Promise.resolve(undefined);
		}),
	}));
	const del = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
	const update = vi.fn(() => ({
		set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
	}));
	// D1's `db.batch([...])`. Each statement here is a resolved promise (this
	// mock executes `insert().values()` / `delete().where()` eagerly and records
	// the payload), so the batch just awaits them together (SA2-116).
	const batch = vi.fn((statements: unknown[]) =>
		Promise.all(statements as Promise<unknown>[])
	);

	return {
		db: { select, insert, delete: del, update, batch } as never,
		select,
		insert,
		inserted,
		selectedTables,
		batch,
	};
}
