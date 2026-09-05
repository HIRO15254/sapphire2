import { appRouter } from "@sapphire2/api/routers/index";

interface ProcedureDef {
	inputs: unknown[];
	type: "mutation" | "query" | "subscription";
}

export interface RouterProcedure {
	_def: ProcedureDef;
}

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

export function getRouterInputSchema(path: string): unknown {
	return getProcedure(path)._def.inputs[0];
}
