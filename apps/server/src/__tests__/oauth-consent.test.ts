import { describe, expect, it } from "vitest";
import {
	forceConsentPrompt,
	isAuthorizePath,
	parseConsentPageQuery,
	redirectHostsFrom,
	stripLoginPromptCookie,
	withoutLoginPromptCookie,
} from "../oauth-consent";

const AUTHORIZE =
	"http://localhost:8787/api/auth/mcp/authorize?client_id=c1&response_type=code&state=s1";

describe("forceConsentPrompt", () => {
	it("adds prompt=consent when the client sent none", () => {
		const url = new URL(forceConsentPrompt(AUTHORIZE));
		expect(url.searchParams.get("prompt")).toBe("consent");
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("state")).toBe("s1");
	});

	it("overwrites a client-supplied prompt (login, none, etc.)", () => {
		for (const value of ["login", "none", "select_account", ""]) {
			const url = new URL(forceConsentPrompt(`${AUTHORIZE}&prompt=${value}`));
			expect(url.searchParams.get("prompt")).toBe("consent");
			expect(url.searchParams.getAll("prompt")).toHaveLength(1);
		}
	});

	it("keeps prompt=consent as-is", () => {
		const url = new URL(forceConsentPrompt(`${AUTHORIZE}&prompt=consent`));
		expect(url.searchParams.get("prompt")).toBe("consent");
	});
});

describe("isAuthorizePath", () => {
	it.each([
		"/api/auth/mcp/authorize",
		"/api/auth/oauth2/authorize",
		"/api/auth/mcp/authorize/",
		"/api/auth/some-future-plugin/authorize",
	])("gates %s", (path) => {
		expect(isAuthorizePath(path)).toBe(true);
	});

	it.each([
		"/api/auth/mcp/token",
		"/api/auth/oauth2/consent",
		"/api/auth/sign-in/email",
		"/api/auth/mcp/authorized",
		"/api/auth/authorize-something",
		"/api/auth",
	])("lets %s through untouched", (path) => {
		expect(isAuthorizePath(path)).toBe(false);
	});
});

describe("redirectHostsFrom", () => {
	it("extracts the host of a single registered redirect URL", () => {
		expect(
			redirectHostsFrom("https://claude.ai/api/mcp/auth_callback")
		).toEqual(["claude.ai"]);
	});

	it("splits the comma-joined list better-auth stores", () => {
		expect(
			redirectHostsFrom("https://claude.ai/cb,http://localhost:9999/cb")
		).toEqual(["claude.ai", "localhost:9999"]);
	});

	it("de-duplicates hosts that appear more than once", () => {
		expect(
			redirectHostsFrom("https://claude.ai/a,https://claude.ai/b")
		).toEqual(["claude.ai"]);
	});

	it("drops opaque URIs that have no host so the unknown-destination warning still fires", () => {
		expect(redirectHostsFrom("urn:ietf:wg:oauth:2.0:oob")).toEqual([]);
		expect(redirectHostsFrom("mailto:someone@example.test")).toEqual([]);
		expect(
			redirectHostsFrom("urn:ietf:wg:oauth:2.0:oob,https://ok.test/cb")
		).toEqual(["ok.test"]);
	});

	it("drops unparseable entries rather than rendering attacker text", () => {
		expect(
			redirectHostsFrom(
				"not a url,<script>alert(1)</script>,https://ok.test/cb"
			)
		).toEqual(["ok.test"]);
	});

	it.each([null, undefined, "", "   "])("returns [] for %s", (value) => {
		expect(redirectHostsFrom(value)).toEqual([]);
	});
});

describe("parseConsentPageQuery", () => {
	it("parses the better-auth consent redirect query", () => {
		const query = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?consent_code=abc&client_id=c1&scope=openid%20profile"
		);
		expect(query).toEqual({ clientId: "c1", code: "abc" });
	});

	it("returns null without a consent code or client id", () => {
		expect(
			parseConsentPageQuery("http://localhost:8787/oauth/consent")
		).toBeNull();
		expect(
			parseConsentPageQuery(
				"http://localhost:8787/oauth/consent?consent_code=abc"
			)
		).toBeNull();
		expect(
			parseConsentPageQuery("http://localhost:8787/oauth/consent?client_id=c1")
		).toBeNull();
	});

	it("parses the same result whether or not a scope is present", () => {
		const withScope = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?consent_code=a&client_id=c&scope=openid"
		);
		const withoutScope = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?consent_code=a&client_id=c"
		);
		expect(withScope).toEqual(withoutScope);
	});
});

describe("stripLoginPromptCookie", () => {
	it.each([null, "", "   "])("returns null for %s", (value) => {
		expect(stripLoginPromptCookie(value)).toBeNull();
	});

	it("returns the header unchanged when no login prompt cookie is present", () => {
		expect(stripLoginPromptCookie("better-auth.session_token=abc")).toBe(
			"better-auth.session_token=abc"
		);
	});

	it("returns null when the login prompt cookie is the only one", () => {
		expect(stripLoginPromptCookie("oidc_login_prompt=payload.sig")).toBeNull();
	});

	it.each([
		["a=1; oidc_login_prompt=x", "a=1"],
		["oidc_login_prompt=x; a=1", "a=1"],
		["a=1; oidc_login_prompt=x; b=2", "a=1; b=2"],
		["a=1;oidc_login_prompt=x", "a=1"],
		["oidc_login_prompt=x; oidc_login_prompt=y; a=1", "a=1"],
	])("drops it from %s", (input, expected) => {
		expect(stripLoginPromptCookie(input)).toBe(expected);
	});

	it("drops a signed value that contains = and . characters", () => {
		expect(
			stripLoginPromptCookie(
				"a=1; oidc_login_prompt=%7B%22state%22%3A%22s%22%7D.sig%3D%3D"
			)
		).toBe("a=1");
	});

	it("drops a valueless cookie of the same name", () => {
		expect(stripLoginPromptCookie("a=1; oidc_login_prompt")).toBe("a=1");
	});

	it.each([
		"oidc_login_prompt_extra=1",
		"my_oidc_login_prompt=1",
		"oidc_consent_prompt=1",
	])("keeps the similarly named cookie %s", (input) => {
		expect(stripLoginPromptCookie(`a=1; ${input}`)).toBe(`a=1; ${input}`);
	});
});

describe("withoutLoginPromptCookie", () => {
	const target = "http://localhost:8787/api/auth/sign-in/email";

	it("returns the same request when it carries no cookie header", () => {
		const request = new Request(target, { method: "POST" });
		expect(withoutLoginPromptCookie(request)).toBe(request);
	});

	it("returns the same request when no login prompt cookie is present", () => {
		const request = new Request(target, {
			method: "POST",
			headers: { cookie: "better-auth.session_token=abc" },
		});
		expect(withoutLoginPromptCookie(request)).toBe(request);
	});

	it("returns the same request when the cookie header is empty", () => {
		const request = new Request(target, {
			method: "POST",
			headers: { cookie: "" },
		});
		expect(withoutLoginPromptCookie(request)).toBe(request);
	});

	it("returns the same request for a whitespace-only cookie header, which Headers normalizes to empty", () => {
		const request = new Request(target, {
			method: "POST",
			headers: { cookie: "   " },
		});
		expect(request.headers.get("cookie")).toBe("");
		expect(withoutLoginPromptCookie(request)).toBe(request);
	});

	it("removes the login prompt cookie while keeping the session cookie", () => {
		const request = new Request(target, {
			method: "POST",
			headers: { cookie: "better-auth.session_token=abc; oidc_login_prompt=x" },
		});
		const stripped = withoutLoginPromptCookie(request);
		expect(stripped).not.toBe(request);
		expect(stripped.headers.get("cookie")).toBe(
			"better-auth.session_token=abc"
		);
	});

	it("deletes the cookie header entirely when nothing else remains", () => {
		const request = new Request(target, {
			method: "POST",
			headers: { cookie: "oidc_login_prompt=x" },
		});
		expect(withoutLoginPromptCookie(request).headers.get("cookie")).toBeNull();
	});

	it("preserves method, url, other headers and body", async () => {
		const request = new Request(target, {
			method: "POST",
			headers: {
				cookie: "oidc_login_prompt=x; a=1",
				"content-type": "application/json",
				origin: "http://localhost:3001",
			},
			body: JSON.stringify({ email: "a@b.test" }),
		});
		const stripped = withoutLoginPromptCookie(request);
		expect(stripped.method).toBe("POST");
		expect(stripped.url).toBe(target);
		expect(stripped.headers.get("content-type")).toBe("application/json");
		expect(stripped.headers.get("origin")).toBe("http://localhost:3001");
		expect(await stripped.text()).toBe(JSON.stringify({ email: "a@b.test" }));
	});
});
