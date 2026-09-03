import { describe, expect, it } from "vitest";
import {
	buildMcpPluginConfig,
	buildPasskeyPluginConfig,
	buildSocialProviders,
	buildTrustedOrigins,
	hashPassword,
	verifyPassword,
} from "../index";

const MCP = {
	consentPage: "/consent",
	loginPage: "/login",
	resource: "https://api.example.com/mcp",
};
const PASSKEY = {
	origin: "https://app.example.com",
	rpID: "app.example.com",
	rpName: "Sapphire 2",
};

describe("buildMcpPluginConfig", () => {
	it("returns null without MCP options so the plugin is not registered", () => {
		expect(buildMcpPluginConfig(undefined)).toBeNull();
	});

	it("requires PKCE and allows dynamic client registration on the OIDC provider", () => {
		expect(buildMcpPluginConfig(MCP)).toEqual({
			loginPage: "/login",
			resource: "https://api.example.com/mcp",
			oidcConfig: {
				loginPage: "/login",
				consentPage: "/consent",
				requirePKCE: true,
				allowDynamicClientRegistration: true,
			},
		});
	});
});

describe("buildPasskeyPluginConfig", () => {
	it("returns null without passkey options so the plugin is not registered", () => {
		expect(buildPasskeyPluginConfig(undefined)).toBeNull();
	});

	it("requires a resident key with preferred user verification", () => {
		expect(buildPasskeyPluginConfig(PASSKEY)).toEqual({
			...PASSKEY,
			authenticatorSelection: {
				residentKey: "required",
				userVerification: "preferred",
			},
		});
	});
});

describe("buildTrustedOrigins", () => {
	it.each([
		["mcp without baseURL", { mcp: MCP }, ["https://web.example.com"]],
		[
			"baseURL without mcp",
			{ baseURL: "https://api.example.com/auth" },
			["https://web.example.com"],
		],
		[
			"mcp and baseURL",
			{ baseURL: "https://api.example.com/auth", mcp: MCP },
			["https://web.example.com", "https://api.example.com"],
		],
	])("trusts the API origin only with %s", (_label, extra, expected) => {
		expect(
			buildTrustedOrigins({ corsOrigin: "https://web.example.com", ...extra })
		).toEqual(expected);
	});
});

describe("buildSocialProviders", () => {
	it.each([
		["google id only", { googleClientId: "g-id" }, {}],
		["google secret only", { googleClientSecret: "g-secret" }, {}],
		[
			"google id and secret",
			{ googleClientId: "g-id", googleClientSecret: "g-secret" },
			{ google: { clientId: "g-id", clientSecret: "g-secret" } },
		],
		["discord id only", { discordClientId: "d-id" }, {}],
		[
			"discord id and secret",
			{ discordClientId: "d-id", discordClientSecret: "d-secret" },
			{ discord: { clientId: "d-id", clientSecret: "d-secret" } },
		],
	])("registers a provider only with %s", (_label, options, expected) => {
		expect(buildSocialProviders(options)).toEqual(expected);
	});
});

describe("password hashing", () => {
	it("verifies the password it hashed and rejects a different one", async () => {
		const stored = await hashPassword("correct horse");
		expect(
			await verifyPassword({ hash: stored, password: "correct horse" })
		).toBe(true);
		expect(
			await verifyPassword({ hash: stored, password: "wrong horse" })
		).toBe(false);
	});
});
