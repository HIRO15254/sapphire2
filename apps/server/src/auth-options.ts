import { runBatch } from "@sapphire2/api/lib/batch";
import { planDefaultGameData } from "@sapphire2/api/services/seed-game-data";
import { selfPlayerInsert } from "@sapphire2/api/services/self-player";
import type { createAuth } from "@sapphire2/auth";
import type { Database } from "@sapphire2/db";

type AuthOptions = Parameters<typeof createAuth>[1];

const PASSKEY_RP_NAME = "sapphire2";

function resolvePasskeyRp(
	corsOrigin: string
): NonNullable<AuthOptions["passkey"]> {
	const url = new URL(corsOrigin);
	return { origin: url.origin, rpID: url.hostname, rpName: PASSKEY_RP_NAME };
}

interface AuthEnv {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	NODE_ENV?: string;
}

export function buildAuthOptions(env: AuthEnv, db: Database): AuthOptions {
	const corsOrigin = new URL(env.CORS_ORIGIN).origin;
	const baseURL = new URL(env.BETTER_AUTH_URL).origin;
	return {
		baseURL,
		corsOrigin,
		discordClientId: env.DISCORD_CLIENT_ID,
		discordClientSecret: env.DISCORD_CLIENT_SECRET,
		googleClientId: env.GOOGLE_CLIENT_ID,
		googleClientSecret: env.GOOGLE_CLIENT_SECRET,
		mcp: {
			consentPage: `${baseURL}/oauth/consent`,
			loginPage: `${corsOrigin}/login`,
			resource: `${baseURL}/mcp`,
		},
		onUserCreated: async (userId) => {
			const statements = await planDefaultGameData(db, userId);
			await runBatch(db, [selfPlayerInsert(db, userId), ...statements]);
		},
		passkey: resolvePasskeyRp(corsOrigin),
		rateLimitEnabled: env.NODE_ENV === "production",
		secret: env.BETTER_AUTH_SECRET,
	};
}
