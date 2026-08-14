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

/** Compare password-derived bytes without leaking the first mismatched byte. */
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
	/**
	 * Enables the better-auth mcp() plugin (OAuth provider for the /mcp
	 * endpoint): DCR at /api/auth/mcp/register, authorize/token endpoints and
	 * the .well-known metadata. Optional so callers without an MCP surface
	 * (tests) can omit it.
	 */
	mcp?: {
		/**
		 * Absolute URL of the consent page (served by the Worker). Required:
		 * without it the mcp plugin's authorize redirects straight back to the
		 * client with a code — even under prompt=consent — and no user consent
		 * ever happens.
		 */
		consentPage: string;
		/** Absolute URL of the web login page unauthenticated users are sent to. */
		loginPage: string;
		/** RFC 8707 resource identifier — the absolute /mcp endpoint URL. */
		resource: string;
	};
	/**
	 * Fired after better-auth persists a new user row. Used to seed the
	 * per-user game-group / game-variant masters (mix-game rework) so every
	 * new account starts with the full builtin list — see
	 * `@sapphire2/api/services/seed-game-data`. Optional so callers that don't
	 * need it (e.g. tests) can omit it.
	 */
	onUserCreated?: (userId: string) => Promise<void>;
	/**
	 * Enables the passkey() plugin (WebAuthn registration / sign-in endpoints
	 * under /api/auth/passkey/*). The relying party is the WEB app, not the
	 * Worker: the browser runs the ceremony on the web origin, so `rpID` must
	 * be the web hostname and `origin` the web origin. The plugin's own default
	 * (`new URL(baseURL).hostname`) would resolve to the Worker's hostname and
	 * every ceremony would fail on a mismatched RP ID. Optional so callers
	 * without a browser front end (tests) can omit it — derive it with
	 * `resolvePasskeyRp`.
	 */
	passkey?: {
		/** Absolute origin of the web app, no trailing slash. */
		origin: string;
		/** Registrable domain of the web app. */
		rpID: string;
		/** Human-readable name shown in the platform's passkey prompt. */
		rpName: string;
	};
	secret: string;
}

/**
 * Derive the WebAuthn relying-party settings from the web app's origin.
 *
 * Pinning `origin` (rather than letting the plugin fall back to the request's
 * `Origin` header) is deliberate: the header is supplied by the caller, so a
 * fallback would let any origin that can reach the Worker complete a ceremony.
 */
export function resolvePasskeyRp(
	corsOrigin: string,
	rpName: string
): NonNullable<AuthOptions["passkey"]> {
	const url = new URL(corsOrigin);
	return { origin: url.origin, rpID: url.hostname, rpName };
}

/**
 * Body of the `databaseHooks.user.create.after` hook, extracted so it is
 * directly unit-testable without going through better-auth's internals
 * (which are impractical to invoke from a unit test).
 *
 * `onUserCreated` (in practice, `seedDefaultGameData`) is wrapped in a
 * try/catch: signup must succeed even if seeding fails, since every
 * gameGroup/gameVariant/gameMix `list` procedure already self-seeds on next
 * read (c13) — a seed failure here would otherwise take down account
 * creation entirely for an unrelated, retriable side effect.
 */
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
	// Widened to the base plugin type: the mcp() plugin's inferred type
	// references better-auth internals that cannot be named in our emitted
	// declarations (TS4058). Its endpoints exist at runtime regardless;
	// callers that need them (apps/server /mcp gate) cast at the call site.
	const plugins: BetterAuthPlugin[] = [];
	if (options.mcp) {
		plugins.push(
			mcp({
				loginPage: options.mcp.loginPage,
				resource: options.mcp.resource,
				oidcConfig: {
					loginPage: options.mcp.loginPage,
					consentPage: options.mcp.consentPage,
					// OAuth 2.1 posture for public MCP clients.
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
					// Sign-in is usernameless (no email field on the passkey
					// button), which only works with a discoverable credential —
					// the plugin's "preferred" default would let an authenticator
					// store a credential the login page could never offer.
					residentKey: "required",
					userVerification: "preferred",
				},
			}) as BetterAuthPlugin
		);
	}
	// The consent page lives on the SERVER origin (the Worker renders it), so
	// its POST to /oauth2/consent carries that origin — it must be trusted or
	// better-auth's CSRF check answers 403 MISSING_OR_NULL_ORIGIN.
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
