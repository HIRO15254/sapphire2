import { createHash, randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import {
	API_URL,
	expect,
	signIn,
	submitSignIn,
	type TestAccount,
	test,
} from "./fixtures";

interface OAuthClient {
	authorizeUrl: string;
	clientId: string;
	clientName: string;
	redirectUri: string;
	tokenUrl: string;
}

interface ToolResult {
	content: Array<{ type: string; text: string }>;
	isError?: boolean;
}

interface Room {
	id: string;
	memo: string | null;
	name: string;
	userId: string;
}

async function registerClient(
	request: APIRequestContext
): Promise<OAuthClient> {
	const discovery = await request.get(
		`${API_URL}/.well-known/oauth-authorization-server`
	);
	expect(discovery.ok()).toBe(true);
	const metadata = await discovery.json();
	const clientName = `Sapphire E2E ${crypto.randomUUID()}`;
	// A real local callback endpoint; no route interception or external service.
	const redirectUri = `${API_URL}/?oauth_callback=${crypto.randomUUID()}`;
	const response = await request.post(metadata.registration_endpoint, {
		headers: { Origin: API_URL },
		data: {
			client_name: clientName,
			redirect_uris: [redirectUri],
			grant_types: ["authorization_code"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		},
	});
	expect(response.ok(), await response.text()).toBe(true);
	const registered = await response.json();
	expect(registered.client_id).toEqual(expect.any(String));
	expect(registered.token_endpoint_auth_method).toBe("none");
	return {
		authorizeUrl: metadata.authorization_endpoint,
		clientId: registered.client_id,
		clientName,
		redirectUri,
		tokenUrl: metadata.token_endpoint,
	};
}

async function requestConsent(
	page: Page,
	client: OAuthClient,
	account?: TestAccount
) {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	const state = crypto.randomUUID();
	const url = new URL(client.authorizeUrl);
	url.search = new URLSearchParams({
		client_id: client.clientId,
		redirect_uri: client.redirectUri,
		response_type: "code",
		scope: "openid profile",
		resource: `${API_URL}/mcp`,
		code_challenge: challenge,
		code_challenge_method: "S256",
		state,
		// Even a client asking to bypass interaction must see explicit consent.
		prompt: "none",
	}).toString();
	let response = await page.goto(url.toString());
	if (account) {
		await expect(page).toHaveURL(
			(current) =>
				current.origin === "https://localhost:13001" &&
				current.pathname === "/login" &&
				current.searchParams.get("client_id") === client.clientId &&
				current.searchParams.get("state") === state
		);
		[response] = await Promise.all([
			page.waitForResponse(
				(candidate) =>
					candidate.request().isNavigationRequest() &&
					new URL(candidate.url()).pathname === "/oauth/consent"
			),
			submitSignIn(page, account),
		]);
	}
	await expect(page).toHaveURL(
		(current) => current.pathname === "/oauth/consent"
	);
	await expect(
		page.getByRole("heading", { name: "Authorization request" })
	).toBeVisible();
	await expect(
		page.getByText(client.clientName, { exact: true })
	).toBeVisible();
	expect(response?.headers()["cache-control"]).toBe("no-store");
	expect(response?.headers()["x-frame-options"]).toBe("DENY");
	return { state, verifier };
}

async function decideConsent(page: Page, state: string, accept: boolean) {
	await Promise.all([
		page.waitForURL((url) => url.origin === API_URL && url.pathname === "/"),
		page
			.getByRole("button", { name: accept ? "Approve" : "Deny", exact: true })
			.click(),
	]);
	const callback = new URL(page.url());
	expect(callback.searchParams.get("state")).toBe(state);
	return callback;
}

async function authorize(
	page: Page,
	client: OAuthClient,
	account?: TestAccount
) {
	const { state, verifier } = await requestConsent(page, client, account);
	const callback = await decideConsent(page, state, true);
	const code = callback.searchParams.get("code");
	expect(code).toEqual(expect.any(String));
	const response = await page.request.post(client.tokenUrl, {
		headers: { Origin: API_URL },
		form: {
			grant_type: "authorization_code",
			client_id: client.clientId,
			redirect_uri: client.redirectUri,
			code: code as string,
			code_verifier: verifier,
			resource: `${API_URL}/mcp`,
		},
	});
	expect(response.ok(), await response.text()).toBe(true);
	const token = await response.json();
	expect(token.token_type.toLowerCase()).toBe("bearer");
	expect(token.expires_in).toBeGreaterThan(0);
	return token.access_token as string;
}

async function rpc<T>(
	request: APIRequestContext,
	token: string,
	method: string,
	params: Record<string, unknown> = {}
): Promise<T> {
	const id = crypto.randomUUID();
	const response = await request.post(`${API_URL}/mcp`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": "2025-03-26",
		},
		data: { jsonrpc: "2.0", id, method, params },
	});
	expect(response.ok(), await response.text()).toBe(true);
	// The supported legacy MCP profile may frame even initialize as SSE.
	const body = await response.text();
	const messages = response
		.headers()
		["content-type"]?.includes("text/event-stream")
		? body
				.split("\n")
				.filter((line) => line.startsWith("data: "))
				.map((line) => JSON.parse(line.slice(6)))
		: [JSON.parse(body)];
	const message = messages.find((candidate) => candidate.id === id);
	expect(message).toBeTruthy();
	expect(message.id).toBe(id);
	expect(message.error).toBeUndefined();
	return message.result as T;
}

async function callTool<T>(
	request: APIRequestContext,
	token: string,
	name: string,
	args: Record<string, unknown> = {}
): Promise<T> {
	const result = await rpc<ToolResult>(request, token, "tools/call", {
		name,
		arguments: args,
	});
	expect(result.isError, JSON.stringify(result.content)).not.toBe(true);
	const [content] = result.content;
	if (!content || content.type !== "text") {
		throw new Error("Expected a text tool result");
	}
	return JSON.parse(content.text) as T;
}

test("OAuth login continuation and PKCE connect MCP writes to cookie reads with account isolation", async ({
	page,
	account,
	browser,
}) => {
	const client = await registerClient(page.request);
	const token = await authorize(page, client, account);
	const initialized = await rpc<{ serverInfo: { name: string } }>(
		page.request,
		token,
		"initialize",
		{
			protocolVersion: "2025-03-26",
			capabilities: {},
			clientInfo: { name: "sapphire-e2e", version: "1.0.0" },
		}
	);
	expect(initialized.serverInfo.name).toBe("sapphire2");
	const catalogue = await rpc<{ tools: Array<{ name: string }> }>(
		page.request,
		token,
		"tools/list"
	);
	expect(catalogue.tools.map((tool) => tool.name)).toEqual(
		expect.arrayContaining([
			"room_create",
			"room_list",
			"room_get_by_id",
			"room_update",
		])
	);
	const room = await callTool<Room>(page.request, token, "room_create", {
		name: "OAuth private room",
		memo: "Only the granting account can read or change this room.",
	});
	expect(room.name).toBe("OAuth private room");
	const rooms = await callTool<Room[]>(page.request, token, "room_list");
	expect(rooms).toContainEqual(
		expect.objectContaining({ id: room.id, name: room.name })
	);
	const cookieRead = await page.request.get(`${API_URL}/trpc/room.getById`, {
		params: { input: JSON.stringify({ id: room.id }) },
	});
	expect(cookieRead.ok()).toBe(true);
	expect((await cookieRead.json()).result.data).toMatchObject({
		id: room.id,
		memo: room.memo,
	});

	const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
	try {
		const otherPage = await otherContext.newPage();
		const registration = await otherContext.request.post(
			`${API_URL}/api/auth/sign-up/email`,
			{
				headers: { Origin: "https://localhost:13001" },
				data: {
					email: `other-${crypto.randomUUID()}@example.test`,
					password: account.password,
					name: "Other account",
				},
			}
		);
		expect(registration.ok(), await registration.text()).toBe(true);
		const otherToken = await authorize(otherPage, client);
		expect(
			await callTool<Room[]>(otherContext.request, otherToken, "room_list")
		).toEqual([]);
		for (const name of ["room_get_by_id", "room_update"]) {
			const result = await rpc<ToolResult>(
				otherContext.request,
				otherToken,
				"tools/call",
				{
					name,
					arguments: {
						id: room.id,
						...(name === "room_update" ? { name: "Stolen" } : {}),
					},
				}
			);
			expect(result).toEqual({
				isError: true,
				content: [
					{ type: "text", text: "You do not have access to that resource." },
				],
			});
		}
		const forbiddenHttp = await otherContext.request.get(
			`${API_URL}/trpc/room.getById`,
			{
				params: { input: JSON.stringify({ id: room.id }) },
			}
		);
		expect(forbiddenHttp.status()).toBe(403);
		expect((await forbiddenHttp.json()).error.data.code).toBe("FORBIDDEN");
		expect(
			await callTool<Room>(page.request, token, "room_get_by_id", {
				id: room.id,
			})
		).toMatchObject({
			name: "OAuth private room",
			memo: room.memo,
		});
	} finally {
		await otherContext.close();
	}
});

test("requires consent again and preserves OAuth state when access is denied", async ({
	page,
	account,
}) => {
	await signIn(page, account);
	const client = await registerClient(page.request);
	await authorize(page, client);
	const secondGrant = await requestConsent(page, client);
	const denied = await decideConsent(page, secondGrant.state, false);
	expect(denied.searchParams.get("error")).toBe("access_denied");
	expect(denied.searchParams.has("code")).toBe(false);
	expect(denied.searchParams.get("oauth_callback")).toBe(
		new URL(client.redirectUri).searchParams.get("oauth_callback")
	);
});

test("a wrong PKCE verifier cannot exchange an approved authorization code", async ({
	page,
	account,
}) => {
	await signIn(page, account);
	const client = await registerClient(page.request);
	const { state } = await requestConsent(page, client);
	const callback = await decideConsent(page, state, true);
	const response = await page.request.post(client.tokenUrl, {
		headers: { Origin: API_URL },
		form: {
			grant_type: "authorization_code",
			client_id: client.clientId,
			redirect_uri: client.redirectUri,
			code: callback.searchParams.get("code") as string,
			code_verifier: randomBytes(32).toString("base64url"),
		},
	});
	expect(response.status()).toBe(401);
	const body = await response.json();
	// Check the rejection cause rather than pinning the dependency's OAuth error
	// enum (Better Auth 1.6 returns invalid_request for this invalid grant).
	expect(body.error_description).toBe("code verification failed");
	expect(body).not.toHaveProperty("access_token");
});

test("missing and invalid bearer tokens receive an OAuth discovery challenge", async ({
	request,
}) => {
	for (const token of [undefined, "invalid-e2e-access-token"]) {
		const response = await request.post(`${API_URL}/mcp`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
			data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
		});
		expect(response.status()).toBe(401);
		expect(response.headers()["www-authenticate"]).toBe(
			`Bearer resource_metadata="${API_URL}/.well-known/oauth-protected-resource"`
		);
		expect((await response.json()).error.message).toBe(
			"Unauthorized: Authentication required"
		);
	}
});
