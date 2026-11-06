import { mapToolError, type ToolErrorResult } from "../lib/errors";
import type { ToolDefinition } from "./registry";

export interface ToolTextResult {
	content: { type: "text"; text: string }[];
	isError?: undefined;
	[key: string]: unknown;
}

export type ToolCallResult = ToolErrorResult | ToolTextResult;

export type RouterCaller = Record<
	string,
	Record<string, (input: unknown) => Promise<unknown>>
>;

export async function callTool(
	def: ToolDefinition,
	caller: RouterCaller,
	input: unknown,
	log: (error: unknown) => void
): Promise<ToolCallResult> {
	try {
		const [namespace, procedureName] = def.procedurePath.split(".");
		if (!(namespace && procedureName)) {
			throw new Error(`malformed procedure path: "${def.procedurePath}"`);
		}
		const procedure = caller[namespace]?.[procedureName];
		if (typeof procedure !== "function") {
			throw new Error(`caller has no procedure at "${def.procedurePath}"`);
		}
		const result = await procedure(input);
		return { content: [{ text: JSON.stringify(result), type: "text" }] };
	} catch (error) {
		return mapToolError(error, log);
	}
}
