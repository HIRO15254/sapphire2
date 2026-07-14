import { describe, expect, it } from "vitest";
import { createServerEnv } from "../server";

const validEnv = {
	BETTER_AUTH_SECRET: "secret",
	BETTER_AUTH_URL: "https://app.example.com",
	CORS_ORIGIN: "https://app.example.com",
	DB: {},
};

describe("createServerEnv", () => {
	it("parses required bindings and optional keys", () => {
		const env = createServerEnv({ ...validEnv, ANTHROPIC_API_KEY: "key" });
		expect(env.ANTHROPIC_API_KEY).toBe("key");
		expect(env.BETTER_AUTH_URL).toBe("https://app.example.com");
	});

	it.each([
		"BETTER_AUTH_SECRET",
		"BETTER_AUTH_URL",
		"CORS_ORIGIN",
		"DB",
	])("rejects when %s is absent", (key) => {
		const invalid = { ...validEnv } as Record<string, unknown>;
		delete invalid[key];
		expect(() => createServerEnv(invalid)).toThrow();
	});

	it("rejects malformed URLs", () => {
		expect(() =>
			createServerEnv({ ...validEnv, CORS_ORIGIN: "invalid" })
		).toThrow();
		expect(() =>
			createServerEnv({ ...validEnv, BETTER_AUTH_URL: "invalid" })
		).toThrow();
	});
});
