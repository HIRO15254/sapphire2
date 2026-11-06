import { beforeEach, describe, expect, it, vi } from "vitest";
import { TOOL_DEFINITIONS } from "../tools/registry";
import { createSapphireMcpHandler } from "../worker";

const ENDPOINT = "http://localhost/mcp";

interface JsonRpcResponse {
	error?: { code: number; message: string };
	id?: number | string | null;
	jsonrpc: "2.0";
	result?: Record<string, unknown>;
}

async function readMessages(response: Response): Promise<JsonRpcResponse[]> {
	const contentType = response.headers.get("content-type") ?? "";
	const text = await response.text();
	if (contentType.includes("text/event-stream")) {
		return text
			.split("\n")
			.filter((line) => line.startsWith("data: "))
			.map((line) => JSON.parse(line.slice("data: ".length)));
	}
	if (text.length === 0) {
		return [];
	}
	const parsed = JSON.parse(text);
	return Array.isArray(parsed) ? parsed : [parsed];
}

function rpcRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request(ENDPOINT, {
		body: typeof body === "string" ? body : JSON.stringify(body),
		headers: {
			accept: "application/json, text/event-stream",
			"content-type": "application/json",
			...headers,
		},
		method: "POST",
	});
}

const INITIALIZE = {
	id: 1,
	jsonrpc: "2.0",
	method: "initialize",
	params: {
		capabilities: {},
		clientInfo: { name: "vitest", version: "0.0.0" },
		protocolVersion: "2025-03-26",
	},
};

function createHandlerHarness(options?: { result?: unknown; error?: unknown }) {
	const calls: { path: string; input: unknown }[] = [];
	const caller = new Proxy(
		{},
		{
			get: (_target, namespace: string) =>
				new Proxy(
					{},
					{
						get: (_t, procedure: string) => (input: unknown) => {
							calls.push({ input, path: `${namespace}.${procedure}` });
							if (options?.error) {
								return Promise.reject(options.error);
							}
							return Promise.resolve(options?.result ?? { ok: true });
						},
					}
				),
		}
	);
	const log = vi.fn();
	const handler = createSapphireMcpHandler({
		buildCaller: () => caller as never,
		log,
	});
	return { calls, handler, log };
}

describe("MCP protocol layer", () => {
	let harness: ReturnType<typeof createHandlerHarness>;

	beforeEach(() => {
		harness = createHandlerHarness();
	});

	it("answers initialize with server info and tool capability", async () => {
		const response = await harness.handler.fetch(rpcRequest(INITIALIZE));
		expect(response.status).toBe(200);
		const [message] = await readMessages(response);
		expect(message?.error).toBeUndefined();
		const result = message?.result as {
			protocolVersion: string;
			serverInfo: { name: string };
			capabilities: { tools?: unknown };
		};
		expect(result.protocolVersion).toBeTruthy();
		expect(result.serverInfo.name).toBe("sapphire2");
		expect(result.capabilities.tools).toBeDefined();
	});

	it("lists every registered tool with an object input schema and annotations", async () => {
		const response = await harness.handler.fetch(
			rpcRequest({ id: 2, jsonrpc: "2.0", method: "tools/list" })
		);
		const [message] = await readMessages(response);
		expect(message?.error).toBeUndefined();
		const result = message?.result as { tools: Record<string, unknown>[] };
		const { tools } = result;
		expect(tools.map((t) => t.name).sort()).toEqual(
			TOOL_DEFINITIONS.map((d) => d.name).sort()
		);
		for (const tool of tools) {
			expect(
				(tool.inputSchema as { type: string }).type,
				`inputSchema.type of ${String(tool.name)}`
			).toBe("object");
			expect(tool.description).toBeTruthy();
			expect(tool.annotations).toBeDefined();
			expect(
				typeof (tool.annotations as { readOnlyHint: unknown }).readOnlyHint
			).toBe("boolean");
		}
	});

	it("dispatches tools/call to the router procedure and returns its JSON", async () => {
		const withResult = createHandlerHarness({
			result: { items: [], nextCursor: undefined, summary: null },
		});
		const response = await withResult.handler.fetch(
			rpcRequest({
				id: 4,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: { includeArchived: true }, name: "room_list" },
			})
		);
		const [message] = await readMessages(response);
		expect(message?.error).toBeUndefined();
		const result = message?.result as {
			isError?: boolean;
			content: { type: string; text: string }[];
		};
		expect(result.isError).toBeFalsy();
		expect(result.content[0]?.text).toBe(
			JSON.stringify({ items: [], nextCursor: undefined, summary: null })
		);
		expect(withResult.calls).toEqual([
			{ input: { includeArchived: true }, path: "room.list" },
		]);
	});

	it("keeps procedure errors in-band as isError tool results", async () => {
		const failing = createHandlerHarness({
			error: Object.assign(new Error("boom"), { name: "Error" }),
		});
		const response = await failing.handler.fetch(
			rpcRequest({
				id: 5,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: {}, name: "room_list" },
			})
		);
		const [message] = await readMessages(response);
		expect(message?.error).toBeUndefined();
		const result = message?.result as {
			isError?: boolean;
			content: { text: string }[];
		};
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toBe("Internal error.");
		expect(failing.log).toHaveBeenCalledTimes(1);
	});

	it("rejects an unknown tool name with a JSON-RPC error, not a 500", async () => {
		const response = await harness.handler.fetch(
			rpcRequest({
				id: 6,
				jsonrpc: "2.0",
				method: "tools/call",
				params: { arguments: {}, name: "no_such_tool" },
			})
		);
		const [message] = await readMessages(response);
		expect(message?.error).toBeDefined();
		expect(harness.calls).toEqual([]);
	});

	it("rejects arguments that violate the router schema before the procedure runs", async () => {
		const response = await harness.handler.fetch(
			rpcRequest({
				id: 7,
				jsonrpc: "2.0",
				method: "tools/call",
				params: {
					arguments: { id: 42 },
					name: "room_get_by_id",
				},
			})
		);
		const [message] = await readMessages(response);
		const failed =
			message?.error !== undefined ||
			(message?.result as { isError?: boolean } | undefined)?.isError === true;
		expect(failed).toBe(true);
		expect(harness.calls).toEqual([]);
	});

	it("answers an unknown method with -32601", async () => {
		const response = await harness.handler.fetch(
			rpcRequest({ id: 8, jsonrpc: "2.0", method: "foo/bar" })
		);
		const [message] = await readMessages(response);
		expect(message?.error?.code).toBe(-32_601);
	});

	it("answers malformed JSON with -32700", async () => {
		const response = await harness.handler.fetch(rpcRequest("{ not json !!!"));
		const [message] = await readMessages(response);
		expect(message?.error?.code).toBe(-32_700);
	});

	it("accepts notifications/initialized with an empty 202", async () => {
		const response = await harness.handler.fetch(
			rpcRequest({ jsonrpc: "2.0", method: "notifications/initialized" })
		);
		expect(response.status).toBe(202);
	});

	it.each(["GET", "DELETE"] as const)(
		"refuses stateless-unsupported %s requests without crashing",
		async (method) => {
			const response = await harness.handler.fetch(
				new Request(ENDPOINT, {
					headers: { accept: "application/json, text/event-stream" },
					method,
				})
			);
			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(response.status).toBeLessThan(500);
		}
	);
});
