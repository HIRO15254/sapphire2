import z from "zod";

const originSchema = z.url().refine((value) => {
	try {
		const url = new URL(value);
		return (
			(url.protocol === "http:" || url.protocol === "https:") &&
			!url.username &&
			!url.password &&
			url.pathname === "/" &&
			!url.search &&
			!url.hash
		);
	} catch {
		return false;
	}
}, "Must be an HTTP(S) origin");

export const serverEnvSchema = z.object({
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: originSchema,
	CORS_ORIGIN: originSchema,
	DB: z.custom<unknown>((value) => value !== undefined && value !== null),
	DISCORD_CLIENT_ID: z.string().min(1).optional(),
	DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
	GOOGLE_CLIENT_ID: z.string().min(1).optional(),
	GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
	GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
	OPENAI_API_KEY: z.string().min(1).optional(),
});

export function createServerEnv(runtimeEnv: unknown) {
	return serverEnvSchema.parse(runtimeEnv);
}
