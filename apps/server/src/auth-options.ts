import { seedDefaultGameData } from "@sapphire2/api/services/seed-game-data";
import type { createAuth } from "@sapphire2/auth";
import type { Database } from "@sapphire2/db";

type AuthOptions = Parameters<typeof createAuth>[1];

interface AuthEnv {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
}

interface BuildAuthOptionsDeps {
	seedGameData?: (db: Database, userId: string) => Promise<void>;
}

/**
 * The single source of the createAuth options object — every route that
 * instantiates better-auth must use this instead of repeating the literal.
 * The MCP OAuth provider (login page, RFC 8707 resource, consent page) is
 * derived from existing env vars, so /mcp needs no new secrets.
 */
export function buildAuthOptions(
	env: AuthEnv,
	db: Database,
	deps: BuildAuthOptionsDeps = {}
): AuthOptions {
	const seedGameData = deps.seedGameData ?? seedDefaultGameData;
	return {
		corsOrigin: env.CORS_ORIGIN,
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		googleClientId: env.GOOGLE_CLIENT_ID,
		googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		discordClientId: env.DISCORD_CLIENT_ID,
		discordClientSecret: env.DISCORD_CLIENT_SECRET,
		onUserCreated: (userId) => seedGameData(db, userId),
		mcp: {
			consentPage: `${env.BETTER_AUTH_URL}/oauth/consent`,
			loginPage: `${env.CORS_ORIGIN}/login`,
			resource: `${env.BETTER_AUTH_URL}/mcp`,
		},
	};
}
