import { describe, expect, it } from "vitest";
import {
	forceConsentPrompt,
	isAuthorizePath,
	parseConsentPageQuery,
	redirectHostsFrom,
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
		// `new URL("urn:…").host` is "" — keeping it would render an empty
		// destination instead of the warning.
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
		// `scope` is intentionally dropped — scopes do not gate authorization,
		// so nothing downstream may be tempted to display them (rule 8).
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
