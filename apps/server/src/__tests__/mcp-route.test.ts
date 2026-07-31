import { describe, expect, it } from "vitest";
import app from "../worker";
import { createFakeEnv } from "./test-utils";

const env = createFakeEnv();

describe("/mcp route", () => {
	it("answers an unauthenticated POST with a 401 challenge pointing at the resource metadata", async () => {
		const response = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/list",
				}),
			},
			env
		);
		expect(response.status).toBe(401);
		const challenge = response.headers.get("www-authenticate");
		expect(challenge).toContain("Bearer");
		expect(challenge).toContain(
			'resource_metadata="http://localhost:8787/.well-known/oauth-protected-resource"'
		);
	});

	it("exposes WWW-Authenticate to cross-origin MCP clients", async () => {
		const response = await app.request(
			"/mcp",
			{
				method: "POST",
				headers: { origin: "https://claude.ai" },
			},
			env
		);
		expect(response.status).toBe(401);
		expect(response.headers.get("access-control-expose-headers")).toContain(
			"WWW-Authenticate"
		);
	});

	it("answers the /mcp preflight with the MCP header allowances", async () => {
		const response = await app.request(
			"/mcp",
			{
				method: "OPTIONS",
				headers: {
					origin: "https://claude.ai",
					"access-control-request-method": "POST",
					"access-control-request-headers":
						"authorization, content-type, mcp-protocol-version",
				},
			},
			env
		);
		const allowMethods =
			response.headers.get("access-control-allow-methods") ?? "";
		expect(allowMethods).toContain("POST");
		expect(allowMethods).toContain("DELETE");
		const allowHeaders =
			response.headers.get("access-control-allow-headers") ?? "";
		expect(allowHeaders).toContain("Mcp-Session-Id");
		expect(allowHeaders).toContain("MCP-Protocol-Version");
		expect(allowHeaders).toContain("Authorization");
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
	});

	it("keeps the credentialed, origin-pinned CORS on /trpc/* (regression)", async () => {
		const response = await app.request(
			"/trpc/healthCheck",
			{
				method: "OPTIONS",
				headers: {
					origin: "http://localhost:3001",
					"access-control-request-method": "POST",
				},
			},
			env
		);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:3001"
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true"
		);
		expect(
			response.headers.get("access-control-allow-methods") ?? ""
		).not.toContain("DELETE");
	});

	it("still serves the health check root (regression)", async () => {
		const response = await app.request("/", { method: "GET" }, env);
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("OK");
	});
});

describe("/oauth/consent page", () => {
	it("rejects a request without the authorize-flow parameters", async () => {
		const response = await app.request(
			"/oauth/consent",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(400);
	});

	it("renders the consent page with a placeholder name when the client lookup fails", async () => {
		// The fake env's DB stub cannot serve queries — the route must still
		// render (the name is cosmetic; the signed consent_code authorizes).
		const response = await app.request(
			"/oauth/consent?consent_code=abc&client_id=c1&scope=openid%20profile",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("Unknown application");
		expect(html).toContain("openid");
		expect(html).toContain("profile");
		expect(html).toContain("/api/auth/oauth2/consent");
		expect(html).toContain("Approve");
	});
});
