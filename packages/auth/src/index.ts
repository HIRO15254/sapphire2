import { mcp } from "@better-auth/mcp";
import { getOAuthProviderApi } from "@better-auth/oauth-provider";
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
	oauthClient,
	oauthClientAssertion,
	oauthClientRelations,
	oauthClientResource,
	oauthClientResourceRelations,
	oauthConsent,
	oauthConsentRelations,
	oauthRefreshToken,
	oauthRefreshTokenRelations,
	oauthResource,
	oauthResourceRelations,
} from "@sapphire2/db/schema/oauth";
import { passkey, passkeyRelations } from "@sapphire2/db/schema/passkey";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60;
const MCP_REFRESH_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const MCP_TOKEN_STORAGE = "hashed";
const MCP_REGISTRATION_WINDOW_SECONDS = 60 * 60;
const MCP_REGISTRATION_MAX_PER_WINDOW = 20;

export function hashMcpAccessToken(token: string): Promise<string> {
	return Promise.resolve(
		getOAuthProviderApi({} as Parameters<typeof getOAuthProviderApi>[0], {
			consentPage: "",
			loginPage: "",
			storeTokens: MCP_TOKEN_STORAGE,
		}).hashToken(token, "access_token")
	);
}

function hexEncode(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexDecode(hex: string): Uint8Array {
	const matches = hex.match(/.{2}/gu) ?? [];
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
			hash: "SHA-256",
			iterations: 100_000,
			name: "PBKDF2",
			salt: salt.buffer,
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
			hash: "SHA-256",
			iterations: 100_000,
			name: "PBKDF2",
			salt: salt.buffer,
		} as never,
		keyMaterial,
		256
	);
	return constantTimeEqual(new Uint8Array(derivedBits), hexDecode(storedHash));
}

const authSchema = {
	account,
	accountRelations,
	oauthAccessToken,
	oauthAccessTokenRelations,
	oauthClient,
	oauthClientAssertion,
	oauthClientRelations,
	oauthClientResource,
	oauthClientResourceRelations,
	oauthConsent,
	oauthConsentRelations,
	oauthRefreshToken,
	oauthRefreshTokenRelations,
	oauthResource,
	oauthResourceRelations,
	passkey,
	passkeyRelations,
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
				allowDynamicClientRegistration: true,
				allowUnauthenticatedClientRegistration: true,
				clientRegistrationDefaultApplicationType: "infer",
				consentPage: options.mcp.consentPage,
				disableJwtPlugin: true,
				loginPage: options.mcp.loginPage,
				rateLimit: {
					register: {
						max: MCP_REGISTRATION_MAX_PER_WINDOW,
						window: MCP_REGISTRATION_WINDOW_SECONDS,
					},
				},
				refreshTokenExpiresIn: MCP_REFRESH_TOKEN_EXPIRES_IN_SECONDS,
				refreshTokenReuseInterval: 0,
				resource: options.mcp.resource,
				storeTokens: MCP_TOKEN_STORAGE,
			})
		);
	}
	if (options.passkey) {
		plugins.push(
			passkeyPlugin({
				authenticatorSelection: {
					residentKey: "required",
					userVerification: "preferred",
				},
				origin: options.passkey.origin,
				rpID: options.passkey.rpID,
				rpName: options.passkey.rpName,
			}) as BetterAuthPlugin
		);
	}
	const trustedOrigins = [options.corsOrigin];
	if (options.mcp && options.baseURL) {
		trustedOrigins.push(new URL(options.baseURL).origin);
	}
	return betterAuth({
		account: {
			accountLinking: {
				disableImplicitLinking: true,
				enabled: true,
				trustedProviders: ["google", "discord"],
			},
		},
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
			ipAddress: {
				ipAddressHeaders: ["cf-connecting-ip"],
			},
		},
		baseURL: options.baseURL,
		database: drizzleAdapter(dbInstance, {
			provider: "sqlite",
			schema: authSchema,
		}),
		databaseHooks: {
			user: {
				create: {
					after: (createdUser) => runUserCreatedHook(options, createdUser),
				},
			},
		},
		emailAndPassword: {
			enabled: true,
			password: {
				hash: hashPassword,
				verify: verifyPassword,
			},
		},
		plugins,
		secret: options.secret,
		session: {
			expiresIn: SESSION_EXPIRES_IN_SECONDS,
			updateAge: SESSION_UPDATE_AGE_SECONDS,
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
		trustedOrigins,
	});
}
