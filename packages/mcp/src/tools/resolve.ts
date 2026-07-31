import { appRouter } from "@sapphire2/api/routers/index";

interface ProcedureDef {
	inputs: unknown[];
	type: "mutation" | "query" | "subscription";
}

export interface RouterProcedure {
	_def: ProcedureDef;
}

/**
 * The single place the MCP layer reaches into tRPC internals. tRPC v11
 * routers expose a flat `_def.procedures` record keyed by dot-path
 * ("session.list"), which is also what the api test-utils rely on.
 */
function procedureMap(): Record<string, RouterProcedure> {
	return appRouter._def.procedures as unknown as Record<
		string,
		RouterProcedure
	>;
}

export function listProcedurePaths(): string[] {
	return Object.keys(procedureMap());
}

export function getProcedure(path: string): RouterProcedure {
	const procedure = procedureMap()[path];
	if (!procedure) {
		throw new Error(`appRouter has no procedure at path "${path}"`);
	}
	return procedure;
}

export function getProcedureType(path: string): "mutation" | "query" {
	const { type } = getProcedure(path)._def;
	if (type === "subscription") {
		throw new Error(`subscription procedures are not exposable: "${path}"`);
	}
	return type;
}

/** The router's own input Zod schema, or undefined for no-input procedures. */
export function getRouterInputSchema(path: string): unknown {
	return getProcedure(path)._def.inputs[0];
}
