import { createHash, randomBytes } from "node:crypto";
import { describe, expect } from "vitest";
import { test } from "./test-fixture";
import {
	type CookieJar,
	createWorkerClient,
	jsonPost,
	SERVER_URL,
	signUp,
	WEB_ORIGIN,
	type WorkerClient,
} from "./worker-http";

const REDIRECT_URI = "http://localhost:9999/callback";
const MCP_RESOURCE = `${SERVER_URL}/mcp`;

interface TokenResponse {
	access_token?: string;
	error?: string;
	refresh_token?: string;
}

interface AuthorizeOptions {
	codeChallengeMethod?: string;
	state?: string;
}

function form(fields: Record<string, string>) {
	return {
		body: new URLSearchParams(fields).toString(),
		headers: { "content-type": "application/x-www-form-urlencoded" },
		method: "POST",
	};
}

async function registerClient(request: WorkerClient): Promise<string> {
	const response = await request(
		"/api/auth/oauth2/register",
		jsonPost({
			client_name: "Test MCP client",
			grant_types: ["authorization_code", "refresh_token"],
			redirect_uris: [REDIRECT_URI],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		})
	);
	expect(response.status).toBe(201);
	const { client_id } = (await response.json()) as { client_id: string };
	return client_id;
}

async function consentPageQuery(
	request: WorkerClient,
	jar: CookieJar,
	clientId: string,
	codeChallenge: string,
	{ codeChallengeMethod = "S256", state = "state-1" }: AuthorizeOptions = {}
): Promise<Response> {
	const params = new URLSearchParams({
		client_id: clientId,
		code_challenge: codeChallenge,
		code_challenge_method: codeChallengeMethod,
		redirect_uri: REDIRECT_URI,
		resource: MCP_RESOURCE,
		response_type: "code",
		scope: "openid profile offline_access",
		state,
	});
	return await request(`/api/auth/oauth2/authorize?${params}`, {
		jar,
		method: "GET",
	});
}

async function decideConsent(
	request: WorkerClient,
	jar: CookieJar,
	authorize: Response,
	accept: boolean
): Promise<URL> {
	expect(authorize.status).toBe(302);
	const consentPage = new URL(authorize.headers.get("location") ?? "");
	expect(`${consentPage.origin}${consentPage.pathname}`).toBe(
		`${SERVER_URL}/oauth/consent`
	);
	const response = await request("/api/auth/oauth2/consent", {
		...jsonPost(
			{ accept, oauth_query: consentPage.search.slice(1) },
			{ origin: SERVER_URL }
		),
		jar,
	});
	expect(response.status).toBe(200);
	const { url } = (await response.json()) as { url: string };
	return new URL(url);
}

async function connect(request: WorkerClient, email: string) {
	const jar = await signUp(request, email);
	const clientId = await registerClient(request);
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const redirect = await decideConsent(
		request,
		jar,
		await consentPageQuery(request, jar, clientId, challenge),
		true
	);
	const code = redirect.searchParams.get("code");
	expect(code).toBeTruthy();
	const exchange = () =>
		request(
			"/api/auth/oauth2/token",
			form({
				client_id: clientId,
				code: code ?? "",
				code_verifier: verifier,
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				resource: MCP_RESOURCE,
			})
		);
	return { clientId, exchange, jar };
}

function refresh(request: WorkerClient, clientId: string, token: string) {
	return request(
		"/api/auth/oauth2/token",
		form({
			client_id: clientId,
			grant_type: "refresh_token",
			refresh_token: token,
			resource: MCP_RESOURCE,
		})
	);
}

function callMcp(request: WorkerClient, accessToken: string) {
	return request("/mcp", {
		body: JSON.stringify({
			id: 1,
			jsonrpc: "2.0",
			method: "initialize",
			params: {
				capabilities: {},
				clientInfo: { name: "test", version: "1.0.0" },
				protocolVersion: "2025-06-18",
			},
		}),
		headers: {
			accept: "application/json, text/event-stream",
			authorization: `Bearer ${accessToken}`,
			"content-type": "application/json",
		},
		method: "POST",
	});
}

async function listConnections(request: WorkerClient, jar: CookieJar) {
	const response = await request("/trpc/mcpConnection.list", {
		jar,
		method: "GET",
	});
	expect(response.status).toBe(200);
	const body = (await response.json()) as {
		result: { data: { clientId: string; name: string | null }[] };
	};
	return body.result.data;
}

function revokeConnection(
	request: WorkerClient,
	jar: CookieJar,
	clientId: string
) {
	return request("/trpc/mcpConnection.revoke", {
		...jsonPost({ clientId }, { origin: WEB_ORIGIN }),
		jar,
	});
}

describe("MCP OAuth authorization server", () => {
	test("an approved connection yields a token /mcp accepts, and an unknown token is refused", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const { exchange } = await connect(request, "mcp-user@example.test");
		const tokens = (await (await exchange()).json()) as TokenResponse;
		expect((await callMcp(request, tokens.access_token ?? "")).status).toBe(
			200
		);
		const refused = await callMcp(request, "not-a-real-token");
		expect(refused.status).toBe(401);
		expect(refused.headers.get("www-authenticate")).toContain(
			"resource_metadata="
		);
	});

	test("an MCP token outlives the browser session that approved it", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const { clientId, exchange } = await connect(
			request,
			"long-lived@example.test"
		);
		const tokens = (await (await exchange()).json()) as TokenResponse;
		await api.d1
			.prepare("UPDATE session SET expires_at = ?")
			.bind(Math.floor(Date.now() / 1000) - 60)
			.run();
		const refreshed = (await (
			await refresh(request, clientId, tokens.refresh_token ?? "")
		).json()) as TokenResponse;
		expect(refreshed.access_token).toBeTruthy();
		expect((await callMcp(request, refreshed.access_token ?? "")).status).toBe(
			200
		);
	});

	test("disconnecting a client stops its access and refresh tokens and drops it from the list, without touching another user's connection", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const owner = await connect(request, "revoke-owner@example.test");
		const ownerTokens = (await (
			await owner.exchange()
		).json()) as TokenResponse;
		const other = await connect(request, "revoke-other@example.test");
		const otherTokens = (await (
			await other.exchange()
		).json()) as TokenResponse;

		expect(await listConnections(request, owner.jar)).toEqual([
			expect.objectContaining({
				clientId: owner.clientId,
				name: "Test MCP client",
			}),
		]);
		expect(
			(await revokeConnection(request, other.jar, owner.clientId)).status
		).toBe(403);
		expect(
			(await revokeConnection(request, owner.jar, owner.clientId)).status
		).toBe(200);

		expect(
			(await callMcp(request, ownerTokens.access_token ?? "")).status
		).toBe(401);
		const refreshed = await refresh(
			request,
			owner.clientId,
			ownerTokens.refresh_token ?? ""
		);
		expect(refreshed.status).toBe(400);
		expect(((await refreshed.json()) as TokenResponse).error).toBe(
			"invalid_grant"
		);
		expect(await listConnections(request, owner.jar)).toEqual([]);
		expect(
			(await callMcp(request, otherTokens.access_token ?? "")).status
		).toBe(200);
	});

	test("the same authorization code exchanged twice issues tokens only once", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const { exchange } = await connect(request, "double@example.test");
		const responses = await Promise.all([exchange(), exchange()]);
		const statuses = responses.map((response) => response.status).sort();
		expect(statuses).toEqual([200, 400]);
		const rejected = responses.find((response) => response.status === 400);
		// biome-ignore lint/correctness/noUnsafeOptionalChaining: The preceding status assertion guarantees a rejected response.
		expect(((await rejected?.json()) as TokenResponse).error).toBe(
			"invalid_grant"
		);
	});

	test("a rotated refresh token cannot be replayed", async ({ api }) => {
		const request = createWorkerClient(api.d1);
		const { clientId, exchange } = await connect(
			request,
			"rotate@example.test"
		);
		const tokens = (await (await exchange()).json()) as TokenResponse;
		const first = await refresh(request, clientId, tokens.refresh_token ?? "");
		expect(first.status).toBe(200);
		const replay = await refresh(request, clientId, tokens.refresh_token ?? "");
		expect(replay.status).toBe(400);
		expect(((await replay.json()) as TokenResponse).error).toBe(
			"invalid_grant"
		);
	});

	test("a plain PKCE challenge never yields an authorization code", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const jar = await signUp(request, "plain@example.test");
		const clientId = await registerClient(request);
		const response = await consentPageQuery(
			request,
			jar,
			clientId,
			"plain-challenge-value-that-is-long-enough-1234567890",
			{ codeChallengeMethod: "plain" }
		);
		const location = response.headers.get("location") ?? "";
		expect(location).not.toContain("/oauth/consent");
		expect(new URL(location, SERVER_URL).searchParams.get("code")).toBeNull();
	});

	test("denying consent returns access_denied with the client's state", async ({
		api,
	}) => {
		const request = createWorkerClient(api.d1);
		const jar = await signUp(request, "deny@example.test");
		const clientId = await registerClient(request);
		const redirect = await decideConsent(
			request,
			jar,
			await consentPageQuery(request, jar, clientId, "x".repeat(43), {
				state: "deny-state",
			}),
			false
		);
		expect(`${redirect.origin}${redirect.pathname}`).toBe(REDIRECT_URI);
		expect(redirect.searchParams.get("error")).toBe("access_denied");
		expect(redirect.searchParams.get("state")).toBe("deny-state");
		expect(redirect.searchParams.get("code")).toBeNull();
	});

	test.for([
		"javascript:alert(document.domain)",
		"http://example.com/callback",
		"not-a-url",
	])(
		"registration rejects the redirect URI %s",
		async (redirectUri, { api }) => {
			const request = createWorkerClient(api.d1);
			const response = await request(
				"/api/auth/oauth2/register",
				jsonPost({
					redirect_uris: [redirectUri],
					token_endpoint_auth_method: "none",
				})
			);
			expect(response.status).toBe(400);
			expect(
				(await api.d1.prepare("SELECT id FROM oauth_client").all()).results
			).toEqual([]);
		}
	);
});
