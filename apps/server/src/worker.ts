import { trpcServer } from "@hono/trpc-server";
import { createContextFactory } from "@sapphire2/api/context";
import { appRouter } from "@sapphire2/api/routers/index";
import { createAuth } from "@sapphire2/auth";
import { createDb } from "@sapphire2/db";
import { Hono } from "hono";
import { cors } from "hono/cors";

interface Env {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

app.use("/*", (c, next) => {
	const corsMiddleware = cors({
		origin: c.env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	});
	return corsMiddleware(c, next);
});

app.on(["POST", "GET"], "/api/auth/*", (c) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, {
		corsOrigin: c.env.CORS_ORIGIN,
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL,
	});
	return auth.handler(c.req.raw);
});

app.use("/trpc/*", (c, next) => {
	const db = createDb(c.env.DB);
	const auth = createAuth(db, {
		corsOrigin: c.env.CORS_ORIGIN,
		secret: c.env.BETTER_AUTH_SECRET,
		baseURL: c.env.BETTER_AUTH_URL,
	});
	const contextFactory = createContextFactory(auth, db);
	const middleware = trpcServer({
		router: appRouter,
		createContext: (_opts, context) => contextFactory({ context }),
	});
	return middleware(c, next);
});

app.get("/", (c) => c.text("OK"));

export default app;
