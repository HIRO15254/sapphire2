import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "@sapphire2/db/schema/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

function hexEncode(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex: string): Uint8Array {
	const matches = hex.match(/.{2}/g) ?? [];
	return new Uint8Array(matches.map((byte) => Number.parseInt(byte, 16)));
}

async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"]
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt.buffer,
			iterations: 100_000,
			hash: "SHA-256",
		} as never,
		keyMaterial,
		256
	);
	return `${hexEncode(salt)}:${hexEncode(new Uint8Array(derivedBits))}`;
}

async function verifyPassword(data: {
	hash: string;
	password: string;
}): Promise<boolean> {
	const parts = data.hash.split(":");
	const saltHex = parts[0] ?? "";
	const storedHash = parts[1] ?? "";
	const salt = hexDecode(saltHex);
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(data.password),
		"PBKDF2",
		false,
		["deriveBits"]
	);
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt.buffer,
			iterations: 100_000,
			hash: "SHA-256",
		} as never,
		keyMaterial,
		256
	);
	return hexEncode(new Uint8Array(derivedBits)) === storedHash;
}

const authSchema = {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
};

interface AuthOptions {
	baseURL?: string;
	corsOrigin: string;
	discordClientId?: string;
	discordClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	secret: string;
}

export function createAuth(
	dbInstance: Parameters<typeof drizzleAdapter>[0],
	options: AuthOptions
) {
	return betterAuth({
		secret: options.secret,
		baseURL: options.baseURL,
		database: drizzleAdapter(dbInstance, {
			provider: "sqlite",
			schema: authSchema,
		}),
		trustedOrigins: [options.corsOrigin],
		emailAndPassword: {
			enabled: true,
			password: {
				hash: hashPassword,
				verify: verifyPassword,
			},
		},
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		socialProviders: {
			...(options.googleClientId &&
				options.googleClientSecret && {
					google: {
						clientId: options.googleClientId,
						clientSecret: options.googleClientSecret,
					},
				}),
			...(options.discordClientId &&
				options.discordClientSecret && {
					discord: {
						clientId: options.discordClientId,
						clientSecret: options.discordClientSecret,
					},
				}),
		},
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders: ["google", "discord"],
			},
		},
		plugins: [],
	});
}
