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
					inputSchema: def.inputSchema as StandardSchemaWithJSON,
				},
				(args: unknown) => callTool(def, caller, args, log)
			);
		}
	}
	return server;
}
