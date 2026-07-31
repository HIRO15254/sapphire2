import {
	type AuthInfo,
	createMcpHandler,
	type McpHttpHandler,
	preloadSchemas,
} from "@modelcontextprotocol/server";
import { createSapphireMcpServer } from "./server";
import type { RouterCaller } from "./tools/call";

// Isolate runtimes (Workers) must pay the protocol-schema build cost once at
// module scope, not per request. The workerd shim already does this; calling
// it here keeps the guarantee when the bundler resolves the Node shim.
preloadSchemas();

export interface SapphireMcpHandlerOptions {
	/**
	 * Build the tRPC caller for one authenticated request. authInfo is the
	 * verified token info the Worker's auth gate passed to handler.fetch.
	 */
	buildCaller: (
		authInfo: AuthInfo | undefined
	) => Promise<RouterCaller> | RouterCaller;
	log?: (error: unknown) => void;
}

/**
 * The MCP endpoint as a web-standard fetch handler. Authentication happens
 * OUTSIDE this handler (better-auth's withMcpAuth in apps/server); the
 * verified identity arrives via handler.fetch(request, { authInfo }) and is
 * captured here in the per-request factory closure.
 */
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
			// No mid-call notifications are emitted, so plain JSON responses
			// beat an SSE stream (and its keep-alive timer) inside a Worker.
			responseMode: "json",
			legacy: "stateless",
			onerror: (error) => logError(error),
		}
	);
}
