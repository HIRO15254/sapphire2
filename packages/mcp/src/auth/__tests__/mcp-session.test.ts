import { describe, expect, it } from "vitest";
import { buildMcpSession } from "../mcp-session";

const USER = {
	id: "user-1",
	name: "Test User",
	email: "test@example.com",
	emailVerified: true,
	image: null,
	createdAt: new Date(0),
	updatedAt: new Date(0),
};

const TOKEN = {
	userId: "user-1",
	scopes: "openid profile",
	// Relative, not a fixed date: buildMcpSession rejects expired tokens, so a
	// hard-coded timestamp turns the whole suite red once the clock passes it.
	accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
};

describe("buildMcpSession", () => {
	it("builds a tRPC session whose user id drives every ownership check", () => {
		const session = buildMcpSession(TOKEN, USER);
		expect(session?.user.id).toBe("user-1");
		expect(session?.session.userId).toBe("user-1");
	});

	it("carries the token expiry into the synthetic session record", () => {
		const session = buildMcpSession(TOKEN, USER);
		expect(session?.session.expiresAt).toEqual(TOKEN.accessTokenExpiresAt);
	});

	it("rejects an expired access token (better-auth getMcpSession does not check expiry)", () => {
		const expired = {
			...TOKEN,
			accessTokenExpiresAt: new Date(Date.now() - 1000),
		};
		expect(buildMcpSession(expired, USER)).toBeNull();
	});

	it("accepts a token expiring in the future", () => {
		const future = {
			...TOKEN,
			accessTokenExpiresAt: new Date(Date.now() + 60_000),
		};
		expect(buildMcpSession(future, USER)).not.toBeNull();
	});

	it("returns null when the token has no userId", () => {
		expect(buildMcpSession({ ...TOKEN, userId: null }, USER)).toBeNull();
		expect(buildMcpSession({ ...TOKEN, userId: undefined }, USER)).toBeNull();
		expect(buildMcpSession({ ...TOKEN, userId: "" }, USER)).toBeNull();
	});

	it("returns null when the user row no longer exists", () => {
		expect(buildMcpSession(TOKEN, null)).toBeNull();
		expect(buildMcpSession(TOKEN, undefined)).toBeNull();
	});

	it("returns null when the loaded user does not match the token (defense in depth)", () => {
		expect(buildMcpSession(TOKEN, { ...USER, id: "user-2" })).toBeNull();
	});

	it("never fabricates a browser session token", () => {
		const session = buildMcpSession(TOKEN, USER);
		// The synthetic record must not look like (or collide with) a real
		// better-auth session token that could be replayed against /api/auth.
		expect(session?.session.token).toBe("");
	});
});
