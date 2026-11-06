import { describe, expect, it } from "vitest";
import { buildMcpSession } from "../mcp-session";

const USER = {
	createdAt: new Date(0),
	email: "test@example.com",
	emailVerified: true,
	id: "user-1",
	image: null,
	name: "Test User",
	updatedAt: new Date(0),
};

const TOKEN = {
	expiresAt: new Date(Date.now() + 3_600_000),
	userId: "user-1",
};

describe("buildMcpSession", () => {
	it("builds a tRPC session whose user id drives every ownership check", () => {
		const session = buildMcpSession(TOKEN, USER);
		expect(session?.user.id).toBe("user-1");
		expect(session?.session.userId).toBe("user-1");
	});

	it("carries the token expiry into the synthetic session record", () => {
		const session = buildMcpSession(TOKEN, USER);
		expect(session?.session.expiresAt).toEqual(TOKEN.expiresAt);
	});

	it("rejects an expired access token", () => {
		const expired = {
			...TOKEN,
			expiresAt: new Date(Date.now() - 1000),
		};
		expect(buildMcpSession(expired, USER)).toBeNull();
	});

	it("rejects a missing or invalid token expiry instead of granting a session", () => {
		expect(buildMcpSession({ ...TOKEN, expiresAt: null }, USER)).toBeNull();
		expect(
			buildMcpSession({ ...TOKEN, expiresAt: new Date(Number.NaN) }, USER)
		).toBeNull();
	});

	it("returns null when the token has no userId", () => {
		expect(buildMcpSession({ ...TOKEN, userId: null }, USER)).toBeNull();
	});

	it("returns null when the user row no longer exists", () => {
		expect(buildMcpSession(TOKEN, null)).toBeNull();
	});

	it("returns null when the loaded user does not match the token (defense in depth)", () => {
		expect(buildMcpSession(TOKEN, { ...USER, id: "user-2" })).toBeNull();
	});

	it("never fabricates a browser session token", () => {
		const session = buildMcpSession(TOKEN, USER);
		expect(session?.session.token).toBe("");
	});
});
