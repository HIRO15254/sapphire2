import { describe, expect, it } from "vitest";
import app from "../worker";
import { createFakeEnv } from "./test-utils";

const env = createFakeEnv();

describe("OAuth discovery endpoints", () => {
	it("serves the authorization-server metadata at the root well-known path", async () => {
		const response = await app.request(
			"/.well-known/oauth-authorization-server",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.issuer).toBe("http://localhost:8787");
		expect(body.authorization_endpoint).toContain("/api/auth/mcp/authorize");
		expect(body.token_endpoint).toContain("/api/auth/mcp/token");
		expect(body.registration_endpoint).toContain("/api/auth/mcp/register");
		expect(body.code_challenge_methods_supported).toContain("S256");
	});

	it("serves the protected-resource metadata at the root well-known path", async () => {
		const response = await app.request(
			"/.well-known/oauth-protected-resource",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.resource).toBe("http://localhost:8787/mcp");
		expect(body.authorization_servers).toEqual(["http://localhost:8787"]);
	});

	it("serves the RFC 9728 path-suffixed protected-resource variant for /mcp", async () => {
		const response = await app.request(
			"/.well-known/oauth-protected-resource/mcp",
			{ method: "GET" },
			env
		);
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.resource).toBe("http://localhost:8787/mcp");
	});

	it("allows cross-origin reads of the discovery documents", async () => {
		const response = await app.request(
			"/.well-known/oauth-authorization-server",
			{ method: "GET", headers: { origin: "https://claude.ai" } },
			env
		);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
	});
});
