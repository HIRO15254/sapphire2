import { describe, expect, it, vi } from "vitest";
import { buildAuthOptions } from "../auth-options";
import { createFakeEnv } from "./test-utils";

const { planSeed, selfInsert, batch } = vi.hoisted(() => ({
	planSeed: vi.fn(),
	selfInsert: vi.fn(),
	batch: vi.fn(),
}));

vi.mock("@sapphire2/api/services/seed-game-data", () => ({
	planDefaultGameData: planSeed,
}));
vi.mock("@sapphire2/api/services/self-player", () => ({
	selfPlayerInsert: selfInsert,
}));
vi.mock("@sapphire2/api/lib/batch", () => ({ runBatch: batch }));

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

	it("normalizes trailing slashes in OAuth endpoints", () => {
		const options = buildAuthOptions(
			createFakeEnv({
				CORS_ORIGIN: "https://app.example.com/",
				BETTER_AUTH_URL: "https://api.example.com/",
			}),
			FAKE_DB
		);
		expect(options.corsOrigin).toBe("https://app.example.com");
		expect(options.mcp?.consentPage).toBe(
			"https://api.example.com/oauth/consent"
		);
		expect(options.mcp?.loginPage).toBe("https://app.example.com/login");
		expect(options.mcp?.resource).toBe("https://api.example.com/mcp");
	});

	it("submits self player and seed writes in the same batch", async () => {
		const self = {};
		const seed = {};
		planSeed.mockResolvedValue([seed]);
		selfInsert.mockReturnValue(self);
		const options = buildAuthOptions(createFakeEnv(), FAKE_DB);
		await options.onUserCreated?.("user-9");
		expect(planSeed).toHaveBeenCalledWith(FAKE_DB, "user-9");
		expect(selfInsert).toHaveBeenCalledWith(FAKE_DB, "user-9");
		expect(batch).toHaveBeenCalledWith(FAKE_DB, [self, seed]);
	});
});
