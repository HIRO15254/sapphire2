import { describe, expect, it } from "vitest";
import { forceConsentPrompt, parseConsentPageQuery } from "../oauth-consent";

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

describe("parseConsentPageQuery", () => {
	it("parses the better-auth consent redirect query", () => {
		const query = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?consent_code=abc&client_id=c1&scope=openid%20profile"
		);
		expect(query).toEqual({
			clientId: "c1",
			code: "abc",
			scopes: ["openid", "profile"],
		});
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

	it("treats a missing or empty scope as no scopes", () => {
		expect(
			parseConsentPageQuery(
				"http://localhost:8787/oauth/consent?consent_code=a&client_id=c&scope="
			)?.scopes
		).toEqual([]);
		expect(
			parseConsentPageQuery(
				"http://localhost:8787/oauth/consent?consent_code=a&client_id=c"
			)?.scopes
		).toEqual([]);
	});
});
