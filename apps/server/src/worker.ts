import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@sapphire2/api/context";
import { appRouter } from "@sapphire2/api/routers/index";
import { seedDefaultGameData } from "@sapphire2/api/services/seed-game-data";
import { createAuth } from "@sapphire2/auth";
import { createDb } from "@sapphire2/db";
import { createServerEnv } from "@sapphire2/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";

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

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
	createServerEnv(c.env);
	await next();
});
app.use("/*", (c, next) => {
	const corsMiddleware = cors({
		origin: c.env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	});
	return corsMiddleware(c, next);
});

app.post("/api/auth/set-password", async (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, {
		corsOrigin: c.env.CORS_ORIGIN,
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL,
		googleClientId: c.env.GOOGLE_CLIENT_ID,
		googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
		discordClientId: c.env.DISCORD_CLIENT_ID,
		discordClientSecret: c.env.DISCORD_CLIENT_SECRET,
		onUserCreated: (userId) => seedDefaultGameData(db, userId),
	});
	const result = await auth.api.setPassword({
		headers: c.req.raw.headers,
		body: await c.req.json(),
	});
	return c.json(result);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, {
		corsOrigin: c.env.CORS_ORIGIN,
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL,
		googleClientId: c.env.GOOGLE_CLIENT_ID,
		googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
		discordClientId: c.env.DISCORD_CLIENT_ID,
		discordClientSecret: c.env.DISCORD_CLIENT_SECRET,
		onUserCreated: (userId) => seedDefaultGameData(db, userId),
	});
	return auth.handler(c.req.raw);
});

app.use("/trpc/*", (c, next) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, {
		corsOrigin: c.env.CORS_ORIGIN,
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL,
		googleClientId: c.env.GOOGLE_CLIENT_ID,
		googleClientSecret: c.env.GOOGLE_CLIENT_SECRET,
		discordClientId: c.env.DISCORD_CLIENT_ID,
		discordClientSecret: c.env.DISCORD_CLIENT_SECRET,
		onUserCreated: (userId) => seedDefaultGameData(db, userId),
	});
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

app.get("/", (c) => c.text("OK"));

export default app;
