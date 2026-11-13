import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@sapphire2/api/context";
import { appRouter } from "@sapphire2/api/routers/index";
import { createAuth, hashMcpAccessToken } from "@sapphire2/auth";
import { createDb } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { oauthAccessToken, oauthClient } from "@sapphire2/db/schema/oauth";
import { createServerEnv } from "@sapphire2/env/server";
import {
	buildMcpSession,
	createSapphireMcpHandler,
	renderConsentHtml,
} from "@sapphire2/mcp";
import { and, eq, isNull, or } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { buildAuthOptions } from "./auth-options";
import {
	forceConsentPrompt,
	isAuthorizePath,
	parseConsentPageQuery,
	redirectHostsFrom,
} from "./oauth-consent";
import {
	exceedsRedirectUriLimit,
	isRegistrationRequest,
	REGISTRATION_MAX_BODY_BYTES,
	REGISTRATION_MAX_REDIRECT_URIS,
} from "./oauth-registration";

interface Env {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB: D1Database;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_MAPS_API_KEY?: string;
	NODE_ENV?: string;
	OPENAI_API_KEY?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
	createServerEnv(c.env);
	await next();
});

function isMcpClientPath(path: string): boolean {
	return (
		path === "/mcp" ||
		path.startsWith("/.well-known/") ||
		path.startsWith("/api/auth/.well-known/") ||
		path.startsWith("/api/auth/oauth2/")
	);
}

app.use("/*", (c, next) => {
	const corsMiddleware = isMcpClientPath(c.req.path)
		? cors({
				allowHeaders: [
					"Content-Type",
					"Authorization",
					"Accept",
					"Mcp-Session-Id",
					"MCP-Protocol-Version",
					"Last-Event-ID",
				],
				allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
				credentials: false,
				exposeHeaders: [
					"Mcp-Session-Id",
					"MCP-Protocol-Version",
					"WWW-Authenticate",
				],
				maxAge: 86_400,
				origin: "*",
			})
		: cors({
				allowHeaders: ["Content-Type", "Authorization"],
				allowMethods: ["GET", "POST", "OPTIONS"],
				credentials: true,
				origin: new URL(c.env.CORS_ORIGIN).origin,
			});
	return corsMiddleware(c, next);
});

app.post("/api/auth/set-password", async (c) => {
	if (
		c.req.header("Origin") !== new URL(c.env.CORS_ORIGIN).origin ||
		c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase() !==
			"application/json"
	) {
		return c.text("Forbidden", 403);
	}
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	const result = await auth.api.setPassword({
		body: await c.req.json(),
		headers: c.req.raw.headers,
	});
	return c.json(result);
});

app.use("/api/auth/*", (c, next) => {
	if (!isAuthorizePath(c.req.path)) {
		return next();
	}
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(new Request(forceConsentPrompt(c.req.url), c.req.raw));
});

const registrationBodyLimit = bodyLimit({
	maxSize: REGISTRATION_MAX_BODY_BYTES,
	onError: (c) =>
		c.json(
			{
				error: "invalid_client_metadata",
				error_description: `Registration request body exceeds ${REGISTRATION_MAX_BODY_BYTES} bytes`,
			},
			413
		),
});

app.use("/api/auth/*", (c, next) =>
	isRegistrationRequest(c.req.method, c.req.path)
		? registrationBodyLimit(c, next)
		: next()
);

app.use("/api/auth/*", async (c, next) => {
	if (!isRegistrationRequest(c.req.method, c.req.path)) {
		return next();
	}
	const body = await c.req.text();
	if (exceedsRedirectUriLimit(body)) {
		return c.json(
			{
				error: "invalid_redirect_uri",
				error_description: `At most ${REGISTRATION_MAX_REDIRECT_URIS} redirect URIs may be registered`,
			},
			400
		);
	}
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(
		new Request(c.req.url, {
			body,
			headers: c.req.raw.headers,
			method: c.req.method,
		})
	);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(c.req.raw);
});

app.get("/oauth/consent", async (c) => {
	const query = parseConsentPageQuery(c.req.url);
	if (!query) {
		return c.text("Missing consent request parameters", 400);
	}
	let clientName = "";
	let redirectHosts: string[] = [];
	try {
		const db = createDb(c.env.DB);
		const rows = await db
			.select({
				name: oauthClient.name,
				redirectUris: oauthClient.redirectUris,
			})
			.from(oauthClient)
			.where(eq(oauthClient.clientId, query.clientId))
			.limit(1);
		clientName = rows[0]?.name ?? "";
		redirectHosts = redirectHostsFrom(rows[0]?.redirectUris);
	} catch {
		clientName = "";
		redirectHosts = [];
	}
	const nonce = btoa(
		String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))
	);
	c.header("Cache-Control", "no-store");
	c.header("X-Frame-Options", "DENY");
	c.header(
		"Content-Security-Policy",
		`frame-ancestors 'none'; script-src 'nonce-${nonce}'`
	);
	return c.html(
		renderConsentHtml({
			clientName,
			nonce,
			oauthQuery: query.oauthQuery,
			redirectHosts,
		})
	);
});

app.use("/trpc/*", async (c, next) => {
	if (
		c.req.method === "POST" &&
		c.req.header("Origin") !== new URL(c.env.CORS_ORIGIN).origin
	) {
		return c.text("Forbidden", 403);
	}
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	const contextFactory = createContextFactory(
		auth,
		db,
		c.env.OPENAI_API_KEY,
		c.env.GOOGLE_MAPS_API_KEY
	);
	const middleware = trpcServer({
		createContext: (_opts, context) => contextFactory({ context }),
		onError: ({ error, path, type }) => {
			if (error.code === "INTERNAL_SERVER_ERROR") {
				console.error(`[trpc] ${type} ${path ?? "<unknown>"} failed`, error);
			}
		},
		router: appRouter,
	});
	return await middleware(c, next);
});

function mcpUnauthorized(env: Env): Response {
	const wwwAuthenticate = `Bearer resource_metadata="${new URL(env.BETTER_AUTH_URL).origin}/.well-known/oauth-protected-resource"`;
	return Response.json(
		{
			error: {
				code: -32_000,
				message: "Unauthorized: Authentication required",
			},
			id: null,
			jsonrpc: "2.0",
		},
		{ headers: { "WWW-Authenticate": wwwAuthenticate }, status: 401 }
	);
}

function mcpInternalError(): Response {
	return Response.json(
		{
			error: { code: -32_603, message: "Internal error" },
			id: null,
			jsonrpc: "2.0",
		},
		{ status: 500 }
	);
}

const BEARER_PREFIX = /^Bearer\s+/iu;

app.all("/mcp", async (c) => {
	try {
		const authorization = c.req.header("Authorization") ?? "";
		const bearer = BEARER_PREFIX.test(authorization)
			? authorization.replace(BEARER_PREFIX, "").trim()
			: "";
		if (!bearer) {
			return mcpUnauthorized(c.env);
		}
		const db = createDb(c.env.DB);
		const [token] = await db
			.select({
				expiresAt: oauthAccessToken.expiresAt,
				userId: oauthAccessToken.userId,
			})
			.from(oauthAccessToken)
			.innerJoin(
				oauthClient,
				eq(oauthClient.clientId, oauthAccessToken.clientId)
			)
			.where(
				and(
					eq(oauthAccessToken.token, await hashMcpAccessToken(bearer)),
					isNull(oauthAccessToken.revoked),
					or(isNull(oauthClient.disabled), eq(oauthClient.disabled, false))
				)
			)
			.limit(1);
		if (!token) {
			return mcpUnauthorized(c.env);
		}
		const userRows = token.userId
			? await db.select().from(user).where(eq(user.id, token.userId)).limit(1)
			: [];
		const session = buildMcpSession(token, userRows[0]);
		if (!session) {
			return mcpUnauthorized(c.env);
		}
		const caller = appRouter.createCaller({
			db,
			googleMapsApiKey: c.env.GOOGLE_MAPS_API_KEY,
			openaiApiKey: c.env.OPENAI_API_KEY,
			session,
		});
		const handler = createSapphireMcpHandler({
			buildCaller: () => caller as never,
		});
		return await handler.fetch(c.req.raw);
	} catch (error) {
		console.error("[mcp] request failed", error);
		return mcpInternalError();
	}
});

app.get("/.well-known/oauth-authorization-server", async (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	const api = auth.api as unknown as {
		getOAuthServerConfig: () => Promise<Record<string, unknown>>;
	};
	return c.json(await api.getOAuthServerConfig());
});

app.get("/.well-known/*", (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(c.req.raw);
});

app.get("/", (c) => c.text("OK"));

export default app;
