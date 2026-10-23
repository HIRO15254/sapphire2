import { describe, expect, it } from "vitest";
import app from "../worker";
import { createFakeEnv } from "./test-utils";

const env = createFakeEnv();

describe("/mcp route", () => {
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

	it("renders the consent page with placeholders when the client lookup fails", async () => {
		const response = await app.request(
			"/oauth/consent?consent_code=abc&client_id=c1&scope=openid%20profile",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(200);
		const html = await response.text();
		expect(html).toContain("Unknown application");
		expect(html).toContain("did not register a recognizable destination");
		expect(html).toContain("/api/auth/oauth2/consent");
		expect(html).toContain("Approve");
	});
});

describe("better-auth authorize surface", () => {
	it.each([
		["POST", "/api/auth/mcp/authorize"],
		["GET", "/api/auth/oauth2/authorize"],
		["POST", "/api/auth/oauth2/authorize"],
	] as const)("does not serve %s %s (no second authorize route to protect)", async (method, path) => {
		const response = await app.request(
			`${path}?client_id=c1&response_type=code`,
			{ method },
			env
		);
		expect(response.status).toBe(404);
		expect(response.headers.get("location")).toBeNull();
	});
});
