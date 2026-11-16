import { describe, expect, it } from "vitest";
import {
	destinationHostFrom,
	forceConsentPrompt,
	isAuthorizePath,
	parseConsentPageQuery,
} from "../oauth-consent";

const AUTHORIZE =
	"http://localhost:8787/api/auth/oauth2/authorize?client_id=c1&response_type=code&state=s1";

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
		"/api/auth/oauth2/authorize",
		"/api/auth/oauth2/authorize/",
		"/api/auth/some-future-plugin/authorize",
	])("gates %s", (path) => {
		expect(isAuthorizePath(path)).toBe(true);
	});

	it.each([
		"/api/auth/oauth2/token",
		"/api/auth/oauth2/consent",
		"/api/auth/sign-in/email",
		"/api/auth/oauth2/authorized",
		"/api/auth/authorize-something",
		"/api/auth",
	])("lets %s through untouched", (path) => {
		expect(isAuthorizePath(path)).toBe(false);
	});
});

describe("destinationHostFrom", () => {
	const REQUESTED = "https://claude.ai/api/mcp/auth_callback";
	const REGISTERED = ["https://decoy.example/cb", REQUESTED];

	it.each([
		["an array", REGISTERED],
		["the provider's double-encoded JSON text", JSON.stringify(REGISTERED)],
	])("shows only the requested URI's host when stored as %s", (_, stored) => {
		expect(destinationHostFrom(stored, REQUESTED)).toBe("claude.ai");
	});

	it("shows nothing when the requested URI is not one the client registered", () => {
		expect(
			destinationHostFrom(REGISTERED, "https://attacker.example/cb")
		).toBeNull();
		expect(destinationHostFrom(REGISTERED, null)).toBeNull();
	});

	it("treats an opaque registered URI as unknown so the warning still fires", () => {
		expect(
			destinationHostFrom(
				["urn:ietf:wg:oauth:2.0:oob"],
				"urn:ietf:wg:oauth:2.0:oob"
			)
		).toBeNull();
	});

	it.each([null, "not json", '"https://claude.ai/api/mcp/auth_callback"'])(
		"shows nothing when the stored value %s is not a list",
		(stored) => {
			expect(destinationHostFrom(stored, REQUESTED)).toBeNull();
		}
	);
});

describe("parseConsentPageQuery", () => {
	it("keeps the whole signed query so the consent POST can hand it back", () => {
		const query = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?client_id=c1&scope=openid+profile&exp=1&sig=abc"
		);
		expect(query?.clientId).toBe("c1");
		expect(query?.oauthQuery).toBe(
			"client_id=c1&scope=openid+profile&exp=1&sig=abc"
		);
	});

	it("reads the requested redirect URI from the signed query", () => {
		const query = parseConsentPageQuery(
			"http://localhost:8787/oauth/consent?client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb&sig=abc"
		);
		expect(query?.redirectUri).toBe("https://claude.ai/cb");
	});

	it("returns null without a signature or client id", () => {
		expect(
			parseConsentPageQuery("http://localhost:8787/oauth/consent")
		).toBeNull();
		expect(
			parseConsentPageQuery("http://localhost:8787/oauth/consent?sig=abc")
		).toBeNull();
		expect(
			parseConsentPageQuery("http://localhost:8787/oauth/consent?client_id=c1")
		).toBeNull();
	});
});
