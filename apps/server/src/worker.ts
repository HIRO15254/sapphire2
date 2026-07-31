import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@sapphire2/api/context";
import { appRouter } from "@sapphire2/api/routers/index";
import { createAuth } from "@sapphire2/auth";
import { createDb } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { oauthApplication } from "@sapphire2/db/schema/oauth";
import { createServerEnv } from "@sapphire2/env/server";
import {
	buildMcpSession,
	createSapphireMcpHandler,
	type McpAccessToken,
	renderConsentHtml,
} from "@sapphire2/mcp";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { buildAuthOptions } from "./auth-options";
import {
	forceConsentPrompt,
	isAuthorizePath,
	parseConsentPageQuery,
	redirectHostsFrom,
} from "./oauth-consent";

interface Env {
	ANTHROPIC_API_KEY?: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB: D1Database;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_MAPS_API_KEY?: string;
}

/**
 * The better-auth mcp() plugin endpoints exist at runtime but their types
 * are erased in createAuth's signature (see the plugins note there) — this
 * is the single cast point for them.
 */
interface McpPluginApi {
	getMCPProtectedResource: () => Promise<Record<string, unknown>>;
	getMcpOAuthConfig: () => Promise<Record<string, unknown>>;
	getMcpSession: (options: {
		headers: Headers;
	}) => Promise<(McpAccessToken & Record<string, unknown>) | null>;
}

function mcpApi(auth: ReturnType<typeof createAuth>): McpPluginApi {
	return auth.api as unknown as McpPluginApi;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
	createServerEnv(c.env);
	await next();
});

/**
 * Paths served to arbitrary MCP clients (any origin, bearer auth, no
 * cookies) — as opposed to the credentialed, CORS_ORIGIN-pinned web app
 * surface.
 */
function isMcpClientPath(path: string): boolean {
	return (
		path === "/mcp" ||
		path.startsWith("/.well-known/") ||
		path.startsWith("/api/auth/mcp/")
	);
}

app.use("/*", (c, next) => {
	const corsMiddleware = isMcpClientPath(c.req.path)
		? cors({
				origin: "*",
				allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
				allowHeaders: [
					"Content-Type",
					"Authorization",
					"Accept",
					"Mcp-Session-Id",
					"MCP-Protocol-Version",
					"Last-Event-ID",
				],
				exposeHeaders: [
					"Mcp-Session-Id",
					"MCP-Protocol-Version",
					"WWW-Authenticate",
				],
				maxAge: 86_400,
				credentials: false,
			})
		: cors({
				origin: c.env.CORS_ORIGIN,
				allowMethods: ["GET", "POST", "OPTIONS"],
				allowHeaders: ["Content-Type", "Authorization"],
				credentials: true,
			});
	return corsMiddleware(c, next);
});

app.post("/api/auth/set-password", async (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	const result = await auth.api.setPassword({
		headers: c.req.raw.headers,
		body: await c.req.json(),
	});
	return c.json(result);
});

// Consent gate: rewrite EVERY authorize request to prompt=consent before
// better-auth sees it — the mcp plugin issues a code without any consent step
// otherwise, and DCR means arbitrary clients exist (see oauth-consent.ts).
// Matching by path suffix on all methods is deliberate default-deny: today
// only `GET /api/auth/mcp/authorize` exists (POST and /api/auth/oauth2/authorize
// both 404), but a better-auth upgrade must not be able to add a route that
// bypasses the gate.
app.on(["GET", "POST"], "/api/auth/*", (c, next) => {
	if (!isAuthorizePath(c.req.path)) {
		return next();
	}
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(new Request(forceConsentPrompt(c.req.url), c.req.raw));
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return auth.handler(c.req.raw);
});

// The consent page better-auth redirects to mid-authorize. Name and redirect
// hosts come from the DCR row; a lookup failure falls back to placeholders —
// both are cosmetic, while the signed consent_code is what authorizes.
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
				name: oauthApplication.name,
				redirectUrls: oauthApplication.redirectUrls,
			})
			.from(oauthApplication)
			.where(eq(oauthApplication.clientId, query.clientId))
			.limit(1);
		clientName = rows[0]?.name ?? "";
		redirectHosts = redirectHostsFrom(rows[0]?.redirectUrls);
	} catch {
		clientName = "";
		redirectHosts = [];
	}
	// The page embeds a consent_code that can be exchanged for an
	// authorization code — keep it out of the browser's history/bfcache.
	c.header("Cache-Control", "no-store");
	return c.html(
		renderConsentHtml({
			clientId: query.clientId,
			clientName,
			code: query.code,
			redirectHosts,
		})
	);
});

app.use("/trpc/*", (c, next) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	const contextFactory = createContextFactory(
		auth,
		db,
		c.env.ANTHROPIC_API_KEY,
		c.env.GOOGLE_MAPS_API_KEY
	);
	const middleware = trpcServer({
		router: appRouter,
		createContext: (_opts, context) => contextFactory({ context }),
	});
	return middleware(c, next);
});

/** RFC 9728 challenge for missing/invalid bearer tokens on /mcp. */
function mcpUnauthorized(env: Env): Response {
	const wwwAuthenticate = `Bearer resource_metadata="${env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource"`;
	return Response.json(
		{
			jsonrpc: "2.0",
			error: {
				code: -32_000,
				message: "Unauthorized: Authentication required",
			},
			id: null,
		},
		{ status: 401, headers: { "WWW-Authenticate": wwwAuthenticate } }
	);
}

/** JSON-RPC internal error, so /mcp never answers with a non-JSON-RPC body. */
function mcpInternalError(): Response {
	return Response.json(
		{
			jsonrpc: "2.0",
			error: { code: -32_603, message: "Internal error" },
			id: null,
		},
		{ status: 500 }
	);
}

app.all("/mcp", async (c) => {
	try {
		const db = createDb(c.env.DB);
		const auth = createAuth(db, buildAuthOptions(c.env, db));
		const token = await mcpApi(auth).getMcpSession({
			headers: c.req.raw.headers,
		});
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
			session,
			db,
			anthropicApiKey: c.env.ANTHROPIC_API_KEY,
			googleMapsApiKey: c.env.GOOGLE_MAPS_API_KEY,
		});
		const handler = createSapphireMcpHandler({
			buildCaller: () => caller as never,
		});
		return await handler.fetch(c.req.raw);
	} catch (error) {
		// Token lookup / user load / a malformed token shape must still answer
		// in the JSON-RPC envelope the client is parsing, not Hono's plain 500.
		console.error("[mcp] request failed", error);
		return mcpInternalError();
	}
});

// OAuth discovery must live at the ROOT .well-known paths (RFC 8414 /
// RFC 9728) — the better-auth copies under /api/auth/.well-known/* are not
// where clients look. The path-suffixed protected-resource variant covers
// clients that append the resource path per RFC 9728 §3.1.
app.get("/.well-known/oauth-authorization-server", async (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, buildAuthOptions(c.env, db));
	return c.json(await mcpApi(auth).getMcpOAuthConfig());
});

app.on(
	"GET",
	[
		"/.well-known/oauth-protected-resource",
		"/.well-known/oauth-protected-resource/mcp",
	],
	async (c) => {
		const db = createDb(c.env.DB);
		const auth = createAuth(db, buildAuthOptions(c.env, db));
		return c.json(await mcpApi(auth).getMCPProtectedResource());
	}
);

app.get("/", (c) => c.text("OK"));

export default app;
