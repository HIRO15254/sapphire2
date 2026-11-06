import { account, user } from "@sapphire2/db/schema/auth";
import { room } from "@sapphire2/db/schema/room";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import { test } from "./test-fixture";
import {
	CookieJar,
	createWorkerClient,
	jsonPost,
	signUp,
	WEB_ORIGIN,
} from "./worker-http";

const VICTIM_EMAIL = "victim@example.test";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function unsignedIdToken(claims: Record<string, unknown>): string {
	const encode = (value: unknown) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.signature`;
}

function stubGoogleTokenEndpoint(): void {
	const realFetch = globalThis.fetch;
	vi.stubGlobal(
		"fetch",
		(input: Request | string | URL, init?: RequestInit): Promise<Response> => {
			const url = input instanceof Request ? input.url : input.toString();
			if (!url.startsWith(GOOGLE_TOKEN_ENDPOINT)) {
				return realFetch(input, init);
			}
			return Promise.resolve(
				Response.json({
					access_token: "google-access-token",
					token_type: "Bearer",
					expires_in: 3600,
					id_token: unsignedIdToken({
						sub: "google-victim",
						email: VICTIM_EMAIL,
						email_verified: true,
						name: "Victim",
						iat: Math.floor(Date.now() / 1000),
						exp: Math.floor(Date.now() / 1000) + 3600,
					}),
				})
			);
		}
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("social sign-in account linking", () => {
	test.for([
		{ localEmailVerified: false },
		{ localEmailVerified: true },
	])("a verified Google sign-in does not attach to an account someone pre-registered with the same email (local email verified: $localEmailVerified)", async ({
		localEmailVerified,
	}, { api }) => {
		const request = createWorkerClient(api.d1);
		await signUp(request, VICTIM_EMAIL);
		const [attacker] = await api.db
			.update(user)
			.set({ emailVerified: localEmailVerified })
			.where(eq(user.email, VICTIM_EMAIL))
			.returning({ id: user.id });

		const victim = new CookieJar();
		const errorCallbackURL = `${WEB_ORIGIN}/login?socialError=google`;
		const started = await request("/api/auth/sign-in/social", {
			...jsonPost({
				provider: "google",
				callbackURL: `${WEB_ORIGIN}/`,
				errorCallbackURL,
			}),
			jar: victim,
		});
		expect(started.status).toBe(200);
		const { url } = (await started.json()) as { url: string };
		const state = new URL(url).searchParams.get("state");
		expect(state).toBeTruthy();

		stubGoogleTokenEndpoint();
		const callback = await request(
			`/api/auth/callback/google?code=google-code&state=${encodeURIComponent(state ?? "")}`,
			{ method: "GET", jar: victim }
		);

		expect(callback.status).toBe(302);
		const location = new URL(callback.headers.get("location") ?? "");
		expect(`${location.origin}${location.pathname}`).toBe(
			`${WEB_ORIGIN}/login`
		);
		expect(location.searchParams.get("socialError")).toBe("google");
		expect(location.searchParams.get("error")).toBe("account_not_linked");
		expect(
			await api.db
				.select({ providerId: account.providerId })
				.from(account)
				.where(eq(account.userId, attacker?.id ?? ""))
		).toEqual([{ providerId: "credential" }]);
		const session = await request("/api/auth/get-session", {
			method: "GET",
			jar: victim,
		});
		expect(await session.json()).toBeNull();
	});
});

describe("tRPC mutations", () => {
	test("a mutation sent from another site is rejected before it runs, while the web origin still writes", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const jar = await signUp(request, "member@example.test");
		const createRoom = (origin: string, name: string) =>
			request("/trpc/room.create", {
				...jsonPost({ name }, { origin }),
				jar,
			});

		const crossSite = await createRoom("https://attacker.example", "Planted");
		expect(crossSite.status).toBe(403);
		expect(
			await api.db.select().from(room).where(eq(room.name, "Planted"))
		).toEqual([]);

		const sameSite = await createRoom(WEB_ORIGIN, "Home game");
		expect(sameSite.status).toBe(200);
		expect(
			await api.db
				.select({ name: room.name })
				.from(room)
				.where(eq(room.name, "Home game"))
		).toEqual([{ name: "Home game" }]);
	});
});
