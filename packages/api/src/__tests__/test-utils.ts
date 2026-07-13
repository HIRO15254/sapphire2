import { Column, getTableName, is, SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { expect, vi } from "vitest";

const dialect = new SQLiteSyncDialect();

/** Bound params of a drizzle `where(...)` condition, for asserting ownership scoping (SA2-176, SA2-183). */
export function boundParams(cond: unknown): unknown[] {
	return dialect.sqlToQuery(cond as never).params;
}

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

/** The JS field key a column is assigned to on its own table object. */
function columnJsKey(column: Column): string | null {
	const table = column.table as unknown as Record<string, unknown>;
	const entry = Object.entries(table).find(([, v]) => v === column);
	return entry?.[0] ?? null;
}

/** The single Column wrapped by an aggregate SQL expression (e.g. `max(col)`). */
function aggregatedColumnKey(expr: SQL): string | null {
	const chunks = (expr as unknown as { queryChunks?: unknown[] }).queryChunks;
	for (const chunk of chunks ?? []) {
		if (is(chunk, Column)) {
			return columnJsKey(chunk);
		}
	}
	return null;
}

/**
 * Applies a `select({ ... })` projection to raw table rows so a single-key
 * aggregate (`{ maxSort: max(table.sortOrder) }`) collapses to one computed
 * row like a real DB would (c35) — every OTHER select shape (bare
 * `select()`, or a narrow/renamed column list) returns the configured rows
 * unchanged, since every existing fixture in this codebase is already
 * written keyed by the query's OUTPUT field names (including cross-table
 * join projections that alias a joined table's column, e.g. stats.ts's
 * `cashVariant: sessionCashDetail.variant`) — re-deriving those keys from the
 * Column reference would only break that established convention. Only MAX
 * is needed by any current caller.
 */
function applyProjection(
	projection: Record<string, unknown> | undefined,
	rows: MockRow[]
): MockRow[] {
	if (!projection) {
		return rows;
	}
	const aggregateEntry = Object.entries(projection).find(([, value]) =>
		is(value, SQL)
	);
	if (!aggregateEntry) {
		return rows;
	}
	const [outKey, expr] = aggregateEntry;
	const colKey = aggregatedColumnKey(expr as SQL);
	const values = rows
		.map((r) => (colKey ? r[colKey] : undefined))
		.filter((v): v is number => typeof v === "number");
	return [{ [outKey]: values.length > 0 ? Math.max(...values) : null }];
}

/**
 * A minimal chainable Drizzle-style mock `db` for exercising router
 * procedures / helpers end-to-end without a real database.
 *
 * `select(projection?)` chains (`.from().where().limit().orderBy()`) resolve
 * to the rows configured for the table passed to `.from(table)` (matched via
 * `getTableName`), narrowed/aggregated through `projection` when one is
 * given; `insert(table).values(rows)` records the inserted payload. It
 * tracks which tables were read (`selectedTables`) and the bound params of
 * every `where(...)` call on select/update/delete (`selectWhereParams` /
 * `updateWhereParams` / `deleteWhereParams`) so ownership scoping can be
 * asserted (SA2-176, SA2-183), and which tables were written (`inserted`).
 */
export function createChainableMockDb(config: ChainableMockDbConfig = {}) {
	const selectRows = config.select ?? {};
	const inserted: Record<string, unknown[]> = {};
	const selectedTables: string[] = [];
	const selectWhereParams: unknown[][] = [];
	const updateWhereParams: unknown[][] = [];
	const deleteWhereParams: unknown[][] = [];

	// The chain is a real Promise (so `await`-ing any step resolves the rows
	// natively) with Drizzle's builder methods attached. Non-terminal steps
	// (`where` / `limit` / `orderBy` / joins) return the same promise.
	function makeSelectChain(rows: MockRow[]) {
		const chain = Promise.resolve(rows) as Promise<MockRow[]> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.where = (cond: unknown) => {
			selectWhereParams.push(boundParams(cond));
			return chain;
		};
		chain.limit = () => chain;
		chain.orderBy = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		return chain;
	}

	const select = vi.fn((projection?: Record<string, unknown>) => ({
		from: (table: unknown) => {
			const name = getTableName(table as never);
			selectedTables.push(name);
			return makeSelectChain(
				applyProjection(projection, selectRows[name] ?? [])
			);
		},
	}));
	const insert = vi.fn((table: unknown) => ({
		values: vi.fn((values: unknown) => {
			const name = getTableName(table as never);
			const bucket = inserted[name] ?? [];
			bucket.push(values);
			inserted[name] = bucket;
			// The insert has already been "recorded" above (this mock executes
			// eagerly, unlike a real DB); `.onConflictDoNothing()` /
			// `.onConflictDoUpdate()` are chainable no-ops so callers that guard
			// concurrent-seed races (c08) don't need a different mock shape.
			const chain = Promise.resolve(undefined) as Promise<undefined> &
				Record<string, (...args: unknown[]) => unknown>;
			chain.onConflictDoNothing = () => chain;
			chain.onConflictDoUpdate = () => chain;
			return chain;
		}),
	}));
	const del = vi.fn(() => ({
		where: vi.fn((cond: unknown) => {
			deleteWhereParams.push(boundParams(cond));
			return Promise.resolve(undefined);
		}),
	}));
	const update = vi.fn(() => ({
		set: vi.fn(() => ({
			where: vi.fn((cond: unknown) => {
				updateWhereParams.push(boundParams(cond));
				return Promise.resolve(undefined);
			}),
		})),
	}));
	// D1's `db.batch([...])`. Each statement here is a resolved promise (this
	// mock executes `insert().values()` / `delete().where()` eagerly and records
	// the payload), so the batch just awaits them together (SA2-116).
	const batch = vi.fn((statements: unknown[]) =>
		Promise.all(statements as Promise<unknown>[])
	);

	return {
		db: { select, insert, delete: del, update, batch } as never,
		selectWhereParams,
		updateWhereParams,
		deleteWhereParams,
		select,
		insert,
		inserted,
		selectedTables,
		batch,
	};
}
