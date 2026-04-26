import { expect } from "vitest";

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
