import {
	type AuthInfo,
	createMcpHandler,
	type McpHttpHandler,
	preloadSchemas,
} from "@modelcontextprotocol/server";
import { createSapphireMcpServer } from "./server";
import type { RouterCaller } from "./tools/call";

preloadSchemas();

export interface SapphireMcpHandlerOptions {
	buildCaller: (
		authInfo: AuthInfo | undefined
	) => Promise<RouterCaller> | RouterCaller;
	log?: (error: unknown) => void;
}

export function createSapphireMcpHandler({
	buildCaller,
	log,
}: SapphireMcpHandlerOptions): McpHttpHandler {
	const logError = log ?? ((error: unknown) => console.error("[mcp]", error));
	return createMcpHandler(
		async (ctx) => {
			const caller = await buildCaller(ctx.authInfo);
			return createSapphireMcpServer({ caller, log: logError });
		},
		{
			responseMode: "json",
			legacy: "stateless",
			onerror: (error) => logError(error),
		}
	);
}
