import { Column, getTableName, is, Param, SQL, StringChunk } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { expect, vi } from "vitest";

const dialect = new SQLiteSyncDialect();

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
	expect(def.middlewares.length).toBeGreaterThanOrEqual(2);
}

export function expectType(
	procedure: unknown,
	type: "mutation" | "query" | "subscription"
): void {
	expect(getProcedureDef(procedure).type).toBe(type);
}

export function expectProcedureSurface(
	router: object,
	expected: Record<string, "mutation" | "query">
): void {
	const procedures = router as Record<string, unknown>;
	expect(Object.keys(procedures).sort()).toEqual(Object.keys(expected).sort());
	for (const [name, type] of Object.entries(expected)) {
		expectProtected(procedures[name]);
		expectType(procedures[name], type);
	}
}

type MockRow = Record<string, unknown>;

interface ChainableMockDbConfig {
	evaluateWhere?: boolean;
	select?: Record<string, MockRow[]>;
}

function columnJsKey(column: Column): string | null {
	const table = column.table as unknown as Record<string, unknown>;
	const entry = Object.entries(table).find(([, v]) => v === column);
	return entry?.[0] ?? null;
}

function aggregatedColumnKey(expr: SQL): string | null {
	const chunks = (expr as unknown as { queryChunks?: unknown[] }).queryChunks;
	for (const chunk of chunks ?? []) {
		if (is(chunk, Column)) {
			return columnJsKey(chunk);
		}
	}
	return null;
}

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

function sqlChunks(node: unknown): unknown[] {
	return (node as { queryChunks?: unknown[] }).queryChunks ?? [];
}

function chunkText(chunks: unknown[]): string {
	return chunks
		.filter((chunk) => chunk instanceof StringChunk)
		.map((chunk) => (chunk as unknown as { value: string[] }).value.join(""))
		.join("")
		.trim();
}

function leafMatches(chunks: unknown[], row: MockRow): boolean {
	const column = chunks.find((chunk) => is(chunk, Column)) as
		| Column
		| undefined;
	const param = chunks.find((chunk) => is(chunk, Param)) as
		| { value: unknown }
		| undefined;
	const operator = chunkText(chunks);
	if (!(column && param)) {
		throw new Error(
			`evaluateWhere: unsupported condition "${operator}" (expected a column/value comparison)`
		);
	}
	const key = columnJsKey(column);
	if (!key) {
		throw new Error(
			`evaluateWhere: cannot resolve a JS key for ${column.name}`
		);
	}
	if (operator === "=") {
		return row[key] === param.value;
	}
	if (operator === "<>") {
		return row[key] !== param.value;
	}
	throw new Error(`evaluateWhere: unsupported operator "${operator}"`);
}

function conditionMatches(condition: unknown, row: MockRow): boolean {
	if (!is(condition, SQL)) {
		throw new Error("evaluateWhere: condition is not a drizzle SQL expression");
	}
	const chunks = sqlChunks(condition);
	const operands = chunks.filter((chunk) => is(chunk, SQL));
	if (operands.length === 0) {
		return leafMatches(chunks, row);
	}
	const keyword = chunkText(chunks).replaceAll("(", "").replaceAll(")", "");
	if (keyword.includes("or")) {
		if (keyword.includes("and")) {
			throw new Error("evaluateWhere: mixed and/or conditions are unsupported");
		}
		return operands.some((operand) => conditionMatches(operand, row));
	}
	return operands.every((operand) => conditionMatches(operand, row));
}

export function withGameMixVariantFixtures(
	select: Record<string, MockRow[]>
): Record<string, MockRow[]> {
	if ("game_mix_variant" in select) {
		return select;
	}
	const memberships = (select.game_mix ?? []).flatMap((mix) => {
		const games = Array.isArray(mix.games) ? mix.games : [];
		return games.map((variantId, position) => ({
			mixId: mix.id,
			position,
			userId: mix.userId,
			variantId,
		}));
	});
	return { ...select, game_mix_variant: memberships };
}

export function createChainableMockDb(config: ChainableMockDbConfig = {}) {
	const selectRows = config.select ?? {};
	const evaluateWhere = config.evaluateWhere ?? false;
	const inserted: Record<string, unknown[]> = {};
	const updated: Record<string, unknown[]> = {};
	const selectedTables: string[] = [];
	const selectWhereParams: unknown[][] = [];
	const selectJoinParams: unknown[][] = [];
	const selectLimits: unknown[] = [];
	const updateWhereParams: unknown[][] = [];
	const deleteWhereParams: unknown[][] = [];

	function makeSelectChain(rows: MockRow[]) {
		const chain = Promise.resolve(rows) as Promise<MockRow[]> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.where = (cond: unknown) => {
			selectWhereParams.push(boundParams(cond));
			if (!evaluateWhere) {
				return chain;
			}
			return makeSelectChain(rows.filter((row) => conditionMatches(cond, row)));
		};
		chain.limit = (value: unknown) => {
			selectLimits.push(value);
			if (!(evaluateWhere && typeof value === "number")) {
				return chain;
			}
			return makeSelectChain(rows.slice(0, value));
		};
		chain.orderBy = () => chain;
		chain.leftJoin = (_table: unknown, cond: unknown) => {
			selectJoinParams.push(boundParams(cond));
			return chain;
		};
		chain.innerJoin = chain.leftJoin;
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
	const update = vi.fn((table: unknown) => ({
		set: vi.fn((values: unknown) => {
			const name = getTableName(table as never);
			const bucket = updated[name] ?? [];
			bucket.push(values);
			updated[name] = bucket;
			return {
				where: vi.fn((cond: unknown) => {
					updateWhereParams.push(boundParams(cond));
					return Promise.resolve(undefined);
				}),
			};
		}),
	}));
	const batch = vi.fn((statements: unknown[]) =>
		Promise.all(statements as Promise<unknown>[])
	);

	return {
		db: { select, insert, delete: del, update, batch } as never,
		selectJoinParams,
		selectLimits,
		selectWhereParams,
		updateWhereParams,
		deleteWhereParams,
		select,
		insert,
		inserted,
		selectedTables,
		batch,
		updated,
	};
}
