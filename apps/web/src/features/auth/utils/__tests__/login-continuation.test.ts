import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	env: { VITE_SERVER_URL: "http://localhost:8787" },
}));

vi.mock("@sapphire2/env/web", () => ({
	env: new Proxy(mocks.env, {
		get: (target, prop) => target[prop as keyof typeof target],
	}),
}));

import { OAUTH_AUTHORIZE_SEARCH, stubLocation } from "@/__tests__/test-utils";
import {
	pendingAuthorizeUrl,
	socialCallbackUrl,
} from "@/features/auth/utils/login-continuation";

describe("pendingAuthorizeUrl", () => {
	it("returns null when the page carries no query string", () => {
		stubLocation({ search: "" });
		expect(pendingAuthorizeUrl()).toBeNull();
	});

	it("returns null when the query is unrelated to an authorize request", () => {
		stubLocation({ search: "?redirect=%2Fsessions" });
		expect(pendingAuthorizeUrl()).toBeNull();
	});

	it("returns null when response_type is missing", () => {
		stubLocation({ search: "?client_id=c1" });
		expect(pendingAuthorizeUrl()).toBeNull();
	});

	it("builds the server authorize URL from the authorize query", () => {
		stubLocation({ search: OAUTH_AUTHORIZE_SEARCH });
		const target = pendingAuthorizeUrl();
		expect(target).not.toBeNull();
		const url = new URL(target as string);
		expect(url.origin).toBe("http://localhost:8787");
		expect(url.pathname).toBe("/api/auth/mcp/authorize");
		expect(url.searchParams.get("client_id")).toBe("c1");
		expect(url.searchParams.get("response_type")).toBe("code");
		expect(url.searchParams.get("redirect_uri")).toBe("https://claude.ai/cb");
		expect(url.searchParams.get("state")).toBe("s1");
	});

	it("drops parameters outside the authorize allowlist", () => {
		stubLocation({
			search: `${OAUTH_AUTHORIZE_SEARCH}&next=https%3A%2F%2Fevil.test`,
		});
		const url = new URL(pendingAuthorizeUrl() as string);
		expect(url.searchParams.get("next")).toBeNull();
	});
});

describe("socialCallbackUrl", () => {
	it("returns the app entry point when no authorize request is pending", () => {
		stubLocation({ origin: "https://app.test", search: "" });
		expect(socialCallbackUrl()).toBe("https://app.test/statistics");
	});

	it("returns to /login with the authorize query when one is pending", () => {
		stubLocation({
			origin: "https://app.test",
			search: OAUTH_AUTHORIZE_SEARCH,
		});
		expect(socialCallbackUrl()).toBe(
			`https://app.test/login${OAUTH_AUTHORIZE_SEARCH}`
		);
	});

	it("keeps the real origin when stubLocation overrides only the search", () => {
		stubLocation({ search: "" });
		expect(window.location.origin).toBe("http://localhost:3000");
		expect(socialCallbackUrl()).toBe("http://localhost:3000/statistics");
	});
});
