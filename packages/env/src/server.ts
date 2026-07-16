import z from "zod";

export const serverEnvSchema = z.object({
	ANTHROPIC_API_KEY: z.string().min(1).optional(),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	CORS_ORIGIN: z.url(),
	DB: z.custom<unknown>((value) => value !== undefined),
	DISCORD_CLIENT_ID: z.string().min(1).optional(),
	DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
	GOOGLE_CLIENT_ID: z.string().min(1).optional(),
	GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
	GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
});

export function createServerEnv(runtimeEnv: unknown) {
	return serverEnvSchema.parse(runtimeEnv);
}
