import { describe, expect, it } from "vitest";
import { createWebEnv } from "../web";

describe("createWebEnv", () => {
	const minimalValid = {
		VITE_SERVER_URL: "https://api.example.com",
	};

	describe("happy path", () => {
		it("parses the minimal valid runtime env", () => {
			const env = createWebEnv(minimalValid);
			expect(env.VITE_SERVER_URL).toBe("https://api.example.com");
		});

		it("includes all preview login fields when provided", () => {
			const env = createWebEnv({
				...minimalValid,
				VITE_PREVIEW_AUTO_LOGIN: "true",
				VITE_PREVIEW_LOGIN_EMAIL: "preview@example.com",
				VITE_PREVIEW_LOGIN_PASSWORD: "secret",
			});
			expect(env.VITE_PREVIEW_AUTO_LOGIN).toBe("true");
			expect(env.VITE_PREVIEW_LOGIN_EMAIL).toBe("preview@example.com");
			expect(env.VITE_PREVIEW_LOGIN_PASSWORD).toBe("secret");
		});

		it("leaves optional preview fields as undefined when absent", () => {
			const env = createWebEnv(minimalValid);
			expect(env.VITE_PREVIEW_AUTO_LOGIN).toBeUndefined();
			expect(env.VITE_PREVIEW_LOGIN_EMAIL).toBeUndefined();
			expect(env.VITE_PREVIEW_LOGIN_PASSWORD).toBeUndefined();
		});

		it("accepts an https URL with a port and path", () => {
			const env = createWebEnv({
				VITE_SERVER_URL: "https://api.example.com:8080/trpc",
			});
			expect(env.VITE_SERVER_URL).toBe("https://api.example.com:8080/trpc");
		});

		it("accepts an http URL (no TLS requirement)", () => {
			const env = createWebEnv({ VITE_SERVER_URL: "http://localhost:3000" });
			expect(env.VITE_SERVER_URL).toBe("http://localhost:3000");
		});
	});

	describe("validation failures", () => {
		it("throws when VITE_SERVER_URL is missing", () => {
			expect(() => createWebEnv({})).toThrow();
		});

		it("throws when VITE_SERVER_URL is an empty string (emptyStringAsUndefined)", () => {
			// Empty string is treated as undefined; then required URL is missing.
			expect(() => createWebEnv({ VITE_SERVER_URL: "" })).toThrow();
		});

		it("throws when VITE_SERVER_URL is not a URL", () => {
			expect(() => createWebEnv({ VITE_SERVER_URL: "not-a-url" })).toThrow();
		});

		it("throws when VITE_SERVER_URL lacks a scheme", () => {
			expect(() => createWebEnv({ VITE_SERVER_URL: "example.com" })).toThrow();
		});

		it("throws when VITE_SERVER_URL is a number", () => {
			expect(() =>
				createWebEnv({ VITE_SERVER_URL: 42 as unknown as string })
			).toThrow();
		});
	});

	describe("emptyStringAsUndefined behavior", () => {
		it("treats empty string preview fields as undefined", () => {
			const env = createWebEnv({
				...minimalValid,
				VITE_PREVIEW_AUTO_LOGIN: "",
				VITE_PREVIEW_LOGIN_EMAIL: "",
				VITE_PREVIEW_LOGIN_PASSWORD: "",
			});
			expect(env.VITE_PREVIEW_AUTO_LOGIN).toBeUndefined();
			expect(env.VITE_PREVIEW_LOGIN_EMAIL).toBeUndefined();
			expect(env.VITE_PREVIEW_LOGIN_PASSWORD).toBeUndefined();
		});
	});

	describe("clientPrefix enforcement", () => {
		it("ignores variables that lack the VITE_ prefix in runtimeEnv", () => {
			// env-core only exposes declared keys, regardless of extra runtime entries.
			const env = createWebEnv({
				...minimalValid,
				SERVER_SECRET: "should-not-leak",
			} as Record<string, string>);
			expect((env as Record<string, unknown>).SERVER_SECRET).toBeUndefined();
		});
	});
});
