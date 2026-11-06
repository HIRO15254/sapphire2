import { describe, expect, it } from "vitest";
import app from "../worker";
import { createFakeEnv } from "./test-utils";

const env = createFakeEnv();
const ISSUER = "http://localhost:8787/api/auth";

describe("OAuth discovery endpoints", () => {
	it.each([
		"/.well-known/oauth-authorization-server",
		"/.well-known/oauth-authorization-server/api/auth",
		"/api/auth/.well-known/oauth-authorization-server",
	])("serves the authorization-server metadata at %s", async (path) => {
		const response = await app.request(path, { method: "GET" }, env);
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.issuer).toBe(ISSUER);
		expect(body.registration_endpoint).toBe(`${ISSUER}/oauth2/register`);
		expect(body.code_challenge_methods_supported).toEqual(["S256"]);
	});

	it.each([
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
	])("serves the protected-resource metadata at %s", async (path) => {
		const response = await app.request(path, { method: "GET" }, env);
		expect(response.status).toBe(200);
		const body = (await response.json()) as Record<string, unknown>;
		expect(body.resource).toBe("http://localhost:8787/mcp");
		expect(body.authorization_servers).toEqual([ISSUER]);
	});

	it("allows cross-origin reads of the discovery documents", async () => {
		const response = await app.request(
			"/.well-known/oauth-authorization-server",
			{ headers: { origin: "https://claude.ai" }, method: "GET" },
			env
		);
		expect(response.headers.get("access-control-allow-origin")).toBe("*");
	});
});
