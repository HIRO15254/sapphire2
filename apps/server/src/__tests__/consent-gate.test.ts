import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeEnv } from "./test-utils";

/**
 * The consent gate is the security core of the MCP OAuth flow: better-auth's
 * mcp plugin issues an authorization code with no consent step unless the
 * request carries `prompt=consent`, and DCR lets anyone register a client.
 *
 * These tests capture the URL the Worker actually hands to better-auth, so
 * they fail if the gate is unwired — unlike status-code assertions, which
 * pass whether or not the middleware ran. The wiring has already changed
 * shape twice (`app.get` → `app.on([...])` → `app.use`) and depends on Hono
 * routing semantics, so it needs a test that watches the seam itself.
 */

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

	it("hands better-auth a prompt=consent authorize URL", async () => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code&state=s1",
			{ method: "GET" },
			env
		);
		expect(handlerUrls).toHaveLength(1);
		const url = lastHandlerUrl();
		expect(url.pathname).toBe("/api/auth/mcp/authorize");
		expect(url.searchParams.get("prompt")).toBe("consent");
	});

	it("overrides a client-supplied prompt that would skip consent", async () => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code&prompt=none",
			{ method: "GET" },
			env
		);
		const url = lastHandlerUrl();
		expect(url.searchParams.getAll("prompt")).toEqual(["consent"]);
	});

	it("preserves every other authorize parameter while rewriting prompt", async () => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code&state=s1&code_challenge=abc&code_challenge_method=S256&scope=openid+profile",
			{ method: "GET" },
			env
		);
		const url = lastHandlerUrl();
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("state")).toBe("s1");
		expect(url.searchParams.get("code_challenge")).toBe("abc");
		expect(url.searchParams.get("code_challenge_method")).toBe("S256");
		expect(url.searchParams.get("scope")).toBe("openid profile");
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
		// Suffix matching is the point: a future plugin route must arrive
		// gated rather than needing someone to remember to add it here.
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
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ newPassword: "password1234" }),
			},
			env
		);
		expect(response.status).toBe(200);
		expect(setPassword).toHaveBeenCalledTimes(1);
		// Its own handler answered — the request never fell through to the
		// generic better-auth route.
		expect(handlerUrls).toHaveLength(0);
	});
});
