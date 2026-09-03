import { describe, expect, it, vi } from "vitest";
import { buildAuthOptions } from "../auth-options";
import { createFakeEnv } from "./test-utils";

const FAKE_DB = {} as never;

describe("buildAuthOptions", () => {
	it("threads the core auth settings from env", () => {
		const options = buildAuthOptions(createFakeEnv(), FAKE_DB);
		expect(options.secret).toBe("test-secret-that-is-at-least-32-chars-long");
		expect(options.baseURL).toBe("http://localhost:8787");
		expect(options.corsOrigin).toBe("http://localhost:3001");
	});

	it("passes social credentials through verbatim", () => {
		const options = buildAuthOptions(
			createFakeEnv({
				GOOGLE_CLIENT_ID: "g-id",
				GOOGLE_CLIENT_SECRET: "g-secret",
				DISCORD_CLIENT_ID: "d-id",
				DISCORD_CLIENT_SECRET: "d-secret",
			}),
			FAKE_DB
		);
		expect(options.googleClientId).toBe("g-id");
		expect(options.googleClientSecret).toBe("g-secret");
		expect(options.discordClientId).toBe("d-id");
		expect(options.discordClientSecret).toBe("d-secret");
	});

	it("configures the MCP OAuth provider from env-derived URLs", () => {
		const options = buildAuthOptions(createFakeEnv(), FAKE_DB);
		expect(options.mcp?.loginPage).toBe("http://localhost:3001/login");
		expect(options.mcp?.resource).toBe("http://localhost:8787/mcp");
		expect(options.mcp?.consentPage).toBe(
			"http://localhost:8787/oauth/consent"
		);
	});

	it("points the passkey relying party at the web app, not the Worker", () => {
		const options = buildAuthOptions(createFakeEnv(), FAKE_DB);
		expect(options.passkey).toEqual({
			origin: "http://localhost:3001",
			rpID: "localhost",
			rpName: "sapphire2",
		});
	});

	it("derives the passkey relying party from a deployed CORS origin", () => {
		const options = buildAuthOptions(
			createFakeEnv({ CORS_ORIGIN: "https://sapphire2.example.com" }),
			FAKE_DB
		);
		expect(options.passkey).toEqual({
			origin: "https://sapphire2.example.com",
			rpID: "sapphire2.example.com",
			rpName: "sapphire2",
		});
	});

	it("keeps the port in the passkey origin but out of the rpID", () => {
		const options = buildAuthOptions(
			createFakeEnv({ CORS_ORIGIN: "https://preview.example.com:8443" }),
			FAKE_DB
		);
		expect(options.passkey?.origin).toBe("https://preview.example.com:8443");
		expect(options.passkey?.rpID).toBe("preview.example.com");
	});

	it("strips a trailing slash from the passkey origin", () => {
		const options = buildAuthOptions(
			createFakeEnv({ CORS_ORIGIN: "https://sapphire2.example.com/" }),
			FAKE_DB
		);
		expect(options.passkey?.origin).toBe("https://sapphire2.example.com");
	});

	it("wires onUserCreated to the game-data seeder", async () => {
		const seed = vi.fn().mockResolvedValue(undefined);
		const options = buildAuthOptions(createFakeEnv(), FAKE_DB, {
			seedGameData: seed,
		});
		await options.onUserCreated?.("user-9");
		expect(seed).toHaveBeenCalledTimes(1);
		expect(seed).toHaveBeenNthCalledWith(1, FAKE_DB, "user-9");
	});
});
