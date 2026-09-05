import { passkey as passkeyPlugin } from "@better-auth/passkey";
import {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
} from "@sapphire2/db/schema/auth";
import {
	oauthAccessToken,
	oauthAccessTokenRelations,
	oauthApplication,
	oauthApplicationRelations,
	oauthConsent,
	oauthConsentRelations,
} from "@sapphire2/db/schema/oauth";
import { passkey, passkeyRelations } from "@sapphire2/db/schema/passkey";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { mcp } from "better-auth/plugins";

function hexEncode(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex: string): Uint8Array {
	const matches = hex.match(/.{2}/g) ?? [];
	return new Uint8Array(matches.map((byte) => Number.parseInt(byte, 16)));
}

export function constantTimeEqual(
	left: Uint8Array,
	right: Uint8Array
): boolean {
	// biome-ignore lint/suspicious/noBitwiseOperators: XOR folds the length mismatch without data-dependent branching.
	let difference = left.length ^ right.length;
	const maxLength = Math.max(left.length, right.length);
	for (let index = 0; index < maxLength; index += 1) {
		// biome-ignore lint/suspicious/noBitwiseOperators: XOR/OR accumulates every byte mismatch in constant work.
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference === 0;
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
	return constantTimeEqual(new Uint8Array(derivedBits), hexDecode(storedHash));
}

const authSchema = {
	account,
	accountRelations,
	session,
	sessionRelations,
	user,
	userRelations,
	verification,
	oauthApplication,
	oauthApplicationRelations,
	oauthAccessToken,
	oauthAccessTokenRelations,
	oauthConsent,
	oauthConsentRelations,
	passkey,
	passkeyRelations,
};

interface AuthOptions {
	baseURL?: string;
	corsOrigin: string;
	discordClientId?: string;
	discordClientSecret?: string;
	googleClientId?: string;
	googleClientSecret?: string;
	mcp?: {
		consentPage: string;
		loginPage: string;
		resource: string;
	};
	onUserCreated?: (userId: string) => Promise<void>;
	passkey?: {
		origin: string;
		rpID: string;
		rpName: string;
	};
	secret: string;
}

export async function runUserCreatedHook(
	options: Pick<AuthOptions, "onUserCreated">,
	createdUser: { id: string }
): Promise<void> {
	try {
		await options.onUserCreated?.(createdUser.id);
	} catch (error) {
		console.error(
			`onUserCreated hook failed for user ${createdUser.id}`,
			error
		);
	}
}

export function createAuth(
	dbInstance: Parameters<typeof drizzleAdapter>[0],
	options: AuthOptions
) {
	const plugins: BetterAuthPlugin[] = [];
	if (options.mcp) {
		plugins.push(
			mcp({
				loginPage: options.mcp.loginPage,
				resource: options.mcp.resource,
				oidcConfig: {
					loginPage: options.mcp.loginPage,
					consentPage: options.mcp.consentPage,
					requirePKCE: true,
					allowDynamicClientRegistration: true,
				},
			})
		);
	}
	if (options.passkey) {
		plugins.push(
			passkeyPlugin({
				rpID: options.passkey.rpID,
				rpName: options.passkey.rpName,
				origin: options.passkey.origin,
				authenticatorSelection: {
					residentKey: "required",
					userVerification: "preferred",
				},
			}) as BetterAuthPlugin
		);
	}
	const trustedOrigins = [options.corsOrigin];
	if (options.mcp && options.baseURL) {
		trustedOrigins.push(new URL(options.baseURL).origin);
	}
	return betterAuth({
		secret: options.secret,
		baseURL: options.baseURL,
		database: drizzleAdapter(dbInstance, {
			provider: "sqlite",
			schema: authSchema,
		}),
		trustedOrigins,
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
				trustedProviders: ["google", "discord", "credential"],
			},
		},
		databaseHooks: {
			user: {
				create: {
					after: (createdUser) => runUserCreatedHook(options, createdUser),
				},
			},
		},
		plugins,
	});
}
