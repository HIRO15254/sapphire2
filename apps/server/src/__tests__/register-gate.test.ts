import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeEnv } from "./test-utils";

const { handled } = vi.hoisted(() => ({
	handled: [] as { body: string; cookie: string | null; url: string }[],
}));

vi.mock("@sapphire2/auth", () => ({
	createAuth: () => ({
		api: { setPassword: vi.fn() },
		handler: async (request: Request) => {
			handled.push({
				body: await request.text(),
				cookie: request.headers.get("cookie"),
				url: request.url,
			});
			return new Response("ok");
		},
	}),
}));

const app = (await import("../worker")).default;
const env = createFakeEnv();

function lastBody(): unknown {
	const entry = handled.at(-1);
	if (!entry) {
		throw new Error("better-auth handler was never called");
	}
	return JSON.parse(entry.body);
}

function registerRequest(body: unknown, headers: Record<string, string> = {}) {
	return app.request(
		"/api/auth/mcp/register",
		{
			method: "POST",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
		},
		env
	);
}

describe("dynamic client registration wiring", () => {
	beforeEach(() => {
		handled.length = 0;
	});

	it("hands better-auth a client_name when the client omits one", async () => {
		await registerRequest({
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
			token_endpoint_auth_method: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
		});
		expect(handled).toHaveLength(1);
		expect(lastBody()).toEqual({
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
			token_endpoint_auth_method: "none",
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			client_name: "",
		});
	});

	it("preserves a client_name the client did send", async () => {
		await registerRequest({
			client_name: "Claude",
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
		});
		expect(lastBody()).toEqual({
			client_name: "Claude",
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
		});
	});

	it("still strips the login-prompt cookie from a registration request", async () => {
		await registerRequest(
			{ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"] },
			{ cookie: "oidc_login_prompt=abc; other=keep" }
		);
		expect(handled.at(-1)?.cookie).toBe("other=keep");
		expect(lastBody()).toMatchObject({ client_name: "" });
	});

	it("leaves the token endpoint body untouched", async () => {
		await app.request(
			"/api/auth/mcp/token",
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "grant_type=authorization_code&code=abc",
			},
			env
		);
		expect(handled.at(-1)?.body).toBe("grant_type=authorization_code&code=abc");
	});

	it("reaches better-auth exactly once per registration", async () => {
		await registerRequest({
			redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
		});
		expect(handled).toHaveLength(1);
		expect(handled[0]?.url).toBe("http://localhost/api/auth/mcp/register");
	});
});
