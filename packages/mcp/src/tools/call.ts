import { mapToolError, type ToolErrorResult } from "../lib/errors";
import type { ToolDefinition } from "./registry";

export interface ToolTextResult {
	content: { type: "text"; text: string }[];
	isError?: undefined;
	// Index signature required by the SDK's CallToolResult shape.
	[key: string]: unknown;
}

export type ToolCallResult = ToolErrorResult | ToolTextResult;

/**
 * The caller returned by appRouter.createCaller(ctx): namespaced async
 * procedures. Typed loosely because tools address procedures by dot-path.
 */
export type RouterCaller = Record<
	string,
	Record<string, (input: unknown) => Promise<unknown>>
>;

/**
 * Invoke the tool's tRPC procedure with the input verbatim — no mapping
 * layer, so the MCP call contract is exactly the API contract. The result is
 * JSON.stringify'd, which serializes Dates to ISO strings and therefore
 * matches the tRPC HTTP response byte-for-byte.
 */
export async function callTool(
	def: ToolDefinition,
	caller: RouterCaller,
	input: unknown,
	log: (error: unknown) => void
): Promise<ToolCallResult> {
	const [namespace, procedureName] = def.procedurePath.split(".");
	if (!(namespace && procedureName)) {
		throw new Error(`malformed procedure path: "${def.procedurePath}"`);
	}
	const procedure = caller[namespace]?.[procedureName];
	if (typeof procedure !== "function") {
		throw new Error(`caller has no procedure at "${def.procedurePath}"`);
	}
	try {
		const result = await procedure(input);
		return { content: [{ type: "text", text: JSON.stringify(result) }] };
	} catch (error) {
		return mapToolError(error, log);
	}
}
