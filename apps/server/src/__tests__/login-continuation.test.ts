import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeEnv } from "./test-utils";

const { handlerRequests, setPassword } = vi.hoisted(() => ({
	handlerRequests: [] as Request[],
	setPassword: vi.fn(),
}));

vi.mock("@sapphire2/auth", () => ({
	createAuth: () => ({
		api: { setPassword },
		handler: (request: Request) => {
			handlerRequests.push(request);
			return new Response("ok");
		},
	}),
}));

const app = (await import("../worker")).default;
const env = createFakeEnv();

const SESSION_COOKIE = "better-auth.session_token=abc";
const LOGIN_PROMPT_COOKIE =
	"oidc_login_prompt=%7B%22client_id%22%3A%22c1%22%7D.signature%3D%3D";

function lastRequest(): Request {
	const request = handlerRequests.at(-1);
	if (!request) {
		throw new Error("better-auth handler was never called");
	}
	return request;
}

describe("oidc_login_prompt stripping", () => {
	beforeEach(() => {
		handlerRequests.length = 0;
		setPassword.mockReset();
		setPassword.mockResolvedValue({ status: true });
	});

	it.each([
		["/api/auth/sign-in/email", "POST"],
		["/api/auth/sign-up/email", "POST"],
		["/api/auth/callback/google", "GET"],
		["/api/auth/mcp/token", "POST"],
		["/api/auth/oauth2/consent", "POST"],
	] as const)("keeps better-auth's built-in continuation from firing on %s", async (path, method) => {
		await app.request(
			path,
			{
				method,
				headers: { cookie: `${SESSION_COOKIE}; ${LOGIN_PROMPT_COOKIE}` },
			},
			env
		);
		expect(handlerRequests).toHaveLength(1);
		expect(lastRequest().headers.get("cookie")).toBe(SESSION_COOKIE);
	});

	it("strips the cookie on the authorize path while still forcing consent", async () => {
		await app.request(
			"/api/auth/mcp/authorize?client_id=c1&response_type=code",
			{
				method: "GET",
				headers: { cookie: `${SESSION_COOKIE}; ${LOGIN_PROMPT_COOKIE}` },
			},
			env
		);
		const request = lastRequest();
		expect(request.headers.get("cookie")).toBe(SESSION_COOKIE);
		expect(new URL(request.url).searchParams.get("prompt")).toBe("consent");
	});

	it("drops the cookie header entirely when nothing else was sent", async () => {
		await app.request(
			"/api/auth/sign-in/email",
			{ method: "POST", headers: { cookie: LOGIN_PROMPT_COOKIE } },
			env
		);
		expect(lastRequest().headers.get("cookie")).toBeNull();
	});

	it("leaves a request without the cookie untouched", async () => {
		await app.request(
			"/api/auth/sign-in/email",
			{ method: "POST", headers: { cookie: SESSION_COOKIE } },
			env
		);
		expect(lastRequest().headers.get("cookie")).toBe(SESSION_COOKIE);
	});

	it("leaves a request with no cookie header at all untouched", async () => {
		await app.request("/api/auth/sign-in/email", { method: "POST" }, env);
		expect(lastRequest().headers.get("cookie")).toBeNull();
	});

	it("forwards the sign-in body and content type unchanged", async () => {
		const body = JSON.stringify({
			email: "tester@example.test",
			password: "password1234",
		});
		await app.request(
			"/api/auth/sign-in/email",
			{
				method: "POST",
				headers: {
					cookie: LOGIN_PROMPT_COOKIE,
					"content-type": "application/json",
				},
				body,
			},
			env
		);
		const request = lastRequest();
		expect(request.method).toBe("POST");
		expect(request.headers.get("content-type")).toBe("application/json");
		expect(await request.text()).toBe(body);
	});
});
