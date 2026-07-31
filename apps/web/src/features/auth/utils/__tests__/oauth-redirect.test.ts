import { describe, expect, it } from "vitest";
import { resolveMcpAuthorizeRedirect } from "../oauth-redirect";

const SERVER = "http://localhost:8787";

const OAUTH_SEARCH = {
	client_id: "client-1",
	response_type: "code",
	redirect_uri: "https://claude.ai/api/mcp/auth_callback",
	scope: "openid profile",
	state: "abc123",
	code_challenge: "challenge",
	code_challenge_method: "S256",
};

describe("resolveMcpAuthorizeRedirect", () => {
	it("returns null when no OAuth authorize query is present", () => {
		expect(resolveMcpAuthorizeRedirect(SERVER, {})).toBeNull();
		expect(resolveMcpAuthorizeRedirect(SERVER, "")).toBeNull();
		expect(resolveMcpAuthorizeRedirect(SERVER, "?foo=bar")).toBeNull();
	});

	it("requires both client_id and response_type", () => {
		expect(resolveMcpAuthorizeRedirect(SERVER, { client_id: "c1" })).toBeNull();
		expect(
			resolveMcpAuthorizeRedirect(SERVER, { response_type: "code" })
		).toBeNull();
	});

	it("always targets the app server's authorize endpoint, never redirect_uri", () => {
		const url = resolveMcpAuthorizeRedirect(SERVER, OAUTH_SEARCH);
		expect(url).not.toBeNull();
		expect(
			url?.startsWith("http://localhost:8787/api/auth/mcp/authorize?")
		).toBe(true);
		expect(url).not.toContain("claude.ai/api/mcp/auth_callback?");
	});

	it("forwards every allowlisted OAuth parameter", () => {
		const url = resolveMcpAuthorizeRedirect(SERVER, OAUTH_SEARCH);
		const params = new URL(url ?? "").searchParams;
		expect(params.get("client_id")).toBe("client-1");
		expect(params.get("response_type")).toBe("code");
		expect(params.get("redirect_uri")).toBe(
			"https://claude.ai/api/mcp/auth_callback"
		);
		expect(params.get("scope")).toBe("openid profile");
		expect(params.get("state")).toBe("abc123");
		expect(params.get("code_challenge")).toBe("challenge");
		expect(params.get("code_challenge_method")).toBe("S256");
	});

	it("drops unknown parameters instead of forwarding them", () => {
		const url = resolveMcpAuthorizeRedirect(SERVER, {
			...OAUTH_SEARCH,
			evil: "https://evil.example",
			redirect: "https://evil.example",
		});
		const params = new URL(url ?? "").searchParams;
		expect(params.get("evil")).toBeNull();
		expect(params.get("redirect")).toBeNull();
	});

	it("ignores non-string parameter values", () => {
		expect(
			resolveMcpAuthorizeRedirect(SERVER, {
				client_id: 42,
				response_type: "code",
			})
		).toBeNull();
		const url = resolveMcpAuthorizeRedirect(SERVER, {
			...OAUTH_SEARCH,
			state: ["a", "b"],
		});
		expect(new URL(url ?? "").searchParams.get("state")).toBeNull();
	});

	it("accepts a raw location.search string", () => {
		const url = resolveMcpAuthorizeRedirect(
			SERVER,
			"?client_id=c1&response_type=code&state=s%20p"
		);
		const params = new URL(url ?? "").searchParams;
		expect(params.get("client_id")).toBe("c1");
		expect(params.get("state")).toBe("s p");
	});

	it("normalizes a trailing slash on the server URL", () => {
		const url = resolveMcpAuthorizeRedirect(`${SERVER}/`, OAUTH_SEARCH);
		expect(
			url?.startsWith("http://localhost:8787/api/auth/mcp/authorize?")
		).toBe(true);
	});

	it("URL-encodes parameter values", () => {
		const url = resolveMcpAuthorizeRedirect(SERVER, {
			client_id: "c 1&x=y",
			response_type: "code",
		});
		expect(url).toContain("client_id=c+1%26x%3Dy");
	});
});
