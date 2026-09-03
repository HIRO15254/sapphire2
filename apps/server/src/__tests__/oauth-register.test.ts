import { describe, expect, it } from "vitest";
import { isOAuthRegisterPath, withClientName } from "../oauth-register";

function registerRequest(body: string, init: RequestInit = {}): Request {
	return new Request("http://localhost:8787/api/auth/mcp/register", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
		...init,
	});
}

describe("isOAuthRegisterPath", () => {
	it.each([
		"/api/auth/mcp/register",
		"/api/auth/oauth2/register",
		"/api/auth/mcp/register/",
		"/api/auth/mcp/register///",
	])("matches the registration path %s", (path) => {
		expect(isOAuthRegisterPath(path)).toBe(true);
	});

	it.each([
		"/api/auth/mcp/registered",
		"/api/auth/mcp/register/extra",
		"/api/auth/sign-up/email",
		"/api/auth/mcp/token",
		"/mcp",
		"",
	])("does not match %s", (path) => {
		expect(isOAuthRegisterPath(path)).toBe(false);
	});
});

describe("withClientName", () => {
	it("defaults a missing client_name to an empty name", async () => {
		const request = registerRequest(
			JSON.stringify({
				redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
				token_endpoint_auth_method: "none",
			})
		);
		const patched = await withClientName(request);
		expect(await patched.json()).toEqual({
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
			token_endpoint_auth_method: "none",
			client_name: "",
		});
	});

	it("defaults an explicit null client_name to an empty name", async () => {
		const patched = await withClientName(
			registerRequest(
				JSON.stringify({
					client_name: null,
					redirect_uris: ["https://c.ai/cb"],
				})
			)
		);
		expect(await patched.json()).toEqual({
			client_name: "",
			redirect_uris: ["https://c.ai/cb"],
		});
	});

	it("keeps method, url and content-type on the rewritten request", async () => {
		const patched = await withClientName(
			registerRequest(JSON.stringify({ redirect_uris: ["https://c.ai/cb"] }))
		);
		expect(patched.method).toBe("POST");
		expect(patched.url).toBe("http://localhost:8787/api/auth/mcp/register");
		expect(patched.headers.get("content-type")).toBe("application/json");
	});

	it("drops a stale content-length so the rewritten body is parseable", async () => {
		const body = JSON.stringify({ redirect_uris: ["https://c.ai/cb"] });
		const patched = await withClientName(
			registerRequest(body, {
				headers: {
					"content-type": "application/json",
					"content-length": String(body.length),
				},
			})
		);
		expect(patched.headers.get("content-length")).toBeNull();
	});

	it.each([
		["a provided client_name", { client_name: "Claude", redirect_uris: [] }],
		["a blank client_name", { client_name: "   ", redirect_uris: [] }],
		["an empty client_name", { client_name: "", redirect_uris: [] }],
	])("leaves %s untouched", async (_label, body) => {
		const request = registerRequest(JSON.stringify(body));
		const patched = await withClientName(request);
		expect(patched).toBe(request);
		expect(await patched.json()).toEqual(body);
	});

	it("leaves a non-string client_name for better-auth validation to reject", async () => {
		const request = registerRequest(
			JSON.stringify({ client_name: 42, redirect_uris: [] })
		);
		expect(await withClientName(request)).toBe(request);
	});

	it.each([
		["a non-JSON body", "not json"],
		["an empty body", ""],
		["a JSON array body", "[]"],
		["a JSON primitive body", '"claude"'],
		["a JSON null body", "null"],
	])("leaves %s untouched", async (_label, body) => {
		const request = registerRequest(body);
		const patched = await withClientName(request);
		expect(patched).toBe(request);
		expect(await patched.text()).toBe(body);
	});

	it("leaves a GET on the registration path untouched", async () => {
		const request = new Request("http://localhost:8787/api/auth/mcp/register", {
			method: "GET",
		});
		expect(await withClientName(request)).toBe(request);
	});

	it("leaves a POST on a non-registration path untouched", async () => {
		const request = new Request("http://localhost:8787/api/auth/mcp/token", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ grant_type: "authorization_code" }),
		});
		const patched = await withClientName(request);
		expect(patched).toBe(request);
		expect(await patched.json()).toEqual({
			grant_type: "authorization_code",
		});
	});
});
