import {
	McpServer,
	type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { callTool, type RouterCaller } from "./tools/call";
import { TOOL_DEFINITIONS, toolAnnotations } from "./tools/registry";

export interface SapphireMcpServerOptions {
	caller: RouterCaller;
	log: (error: unknown) => void;
}

/**
 * Build a per-request McpServer over an authenticated tRPC caller. Every
 * tool is a projection of an appRouter procedure (registry.ts); the caller
 * carries the user's session so protectedProcedure auth and ownership
 * checks run exactly as they do for the HTTP API.
 *
 * The JSON Schema validator is passed explicitly: the runtime-selected
 * default would pull in Ajv (new Function codegen — illegal on Workers)
 * whenever the bundler resolves the Node shim.
 */
export function createSapphireMcpServer({
	caller,
	log,
}: SapphireMcpServerOptions): McpServer {
	const server = new McpServer(
		{ name: "sapphire2", version: "1.0.0" },
		{ jsonSchemaValidator: new CfWorkerJsonSchemaValidator() }
	);
	for (const def of TOOL_DEFINITIONS) {
		const config = {
			description: def.description,
			annotations: toolAnnotations(def),
		};
		if (def.inputSchema === undefined) {
			server.registerTool(def.name, config, () =>
				callTool(def, caller, undefined, log)
			);
		} else {
			server.registerTool(
				def.name,
				{
					...config,
					// The registry stores the router's Zod schema as unknown to
					// stay decoupled from SDK types; it is a Zod object at runtime.
					inputSchema: def.inputSchema as StandardSchemaWithJSON,
				},
				(args: unknown) => callTool(def, caller, args, log)
			);
		}
	}
	return server;
}
