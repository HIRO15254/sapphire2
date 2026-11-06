import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeEnv } from "./test-utils";

const CSP_NONCE = /script-src 'nonce-([^']+)'/;

const { handlerUrls, setPassword } = vi.hoisted(() => ({
	handlerUrls: [] as string[],
	setPassword: vi.fn(),
}));

vi.mock("@sapphire2/auth", () => ({
	createAuth: () => ({
		api: { setPassword },
		handler: (request: Request) => {
			handlerUrls.push(request.url);
			return new Response("ok");
		},
	}),
}));

const app = (await import("../worker")).default;
const env = createFakeEnv();

function lastHandlerUrl(): URL {
	const url = handlerUrls.at(-1);
	if (!url) {
		throw new Error("better-auth handler was never called");
	}
	return new URL(url);
}

describe("authorize consent gate wiring", () => {
	beforeEach(() => {
		handlerUrls.length = 0;
		setPassword.mockReset();
		setPassword.mockResolvedValue({ status: true });
	});

	it.each([
		"POST",
		"PUT",
		"DELETE",
		"PATCH",
	] as const)("gates %s on the authorize path too (default-deny across methods)", async (method) => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code",
			{ method },
			env
		);
		expect(lastHandlerUrl().searchParams.get("prompt")).toBe("consent");
	});

	it("gates an authorize path better-auth does not serve today", async () => {
		await app.request(
			"/api/auth/oauth2/authorize?client_id=c1&response_type=code",
			{ method: "GET" },
			env
		);
		expect(lastHandlerUrl().searchParams.get("prompt")).toBe("consent");
	});

	it("passes non-authorize better-auth routes through unmodified", async () => {
		await app.request(
			"/api/auth/mcp/token?grant_type=authorization_code",
			{ method: "POST" },
			env
		);
		const url = lastHandlerUrl();
		expect(url.pathname).toBe("/api/auth/mcp/token");
		expect(url.searchParams.get("prompt")).toBeNull();
		expect(url.searchParams.get("grant_type")).toBe("authorization_code");
	});

	it.each([
		"/api/auth/sign-in/email",
		"/api/auth/oauth2/consent",
		"/api/auth/mcp/authorized",
	])("does not touch %s", async (path) => {
		await app.request(path, { method: "POST" }, env);
		expect(lastHandlerUrl().searchParams.get("prompt")).toBeNull();
	});

	it("reaches better-auth exactly once per request (no double dispatch)", async () => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code",
			{ method: "GET" },
			env
		);
		expect(handlerUrls).toHaveLength(1);
	});

	it("keeps the set-password route ahead of the gate (registration order)", async () => {
		const response = await app.request(
			"/api/auth/set-password",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: env.CORS_ORIGIN,
				},
				body: JSON.stringify({ newPassword: "password1234" }),
			},
			env
		);
		expect(response.status).toBe(200);
		expect(setPassword).toHaveBeenCalledTimes(1);
		expect(handlerUrls).toHaveLength(0);
	});

	it.each([
		{ origin: "https://attacker.example", "content-type": "application/json" },
		{ origin: "http://localhost:3001", "content-type": "text/plain" },
	])("rejects cross-origin or non-JSON password changes", async (headers) => {
		const response = await app.request(
			"/api/auth/set-password",
			{
				method: "POST",
				headers,
				body: JSON.stringify({ newPassword: "password1234" }),
			},
			env
		);
		expect(response.status).toBe(403);
		expect(setPassword).not.toHaveBeenCalled();
	});

	it("limits consent scripts to the nonce in the rendered page", async () => {
		const response = await app.request(
			"/oauth/consent?client_id=client&consent_code=code",
			undefined,
			env
		);
		const csp = response.headers.get("content-security-policy");
		const nonce = csp?.match(CSP_NONCE)?.[1];
		expect(nonce).toBeTruthy();
		expect(await response.text()).toContain(`nonce="${nonce}"`);
	});
});
