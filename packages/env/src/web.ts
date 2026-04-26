import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const webEnvSchema = {
	clientPrefix: "VITE_" as const,
	client: {
		VITE_SERVER_URL: z.url(),
		VITE_PREVIEW_AUTO_LOGIN: z.string().optional(),
		VITE_PREVIEW_LOGIN_EMAIL: z.string().optional(),
		VITE_PREVIEW_LOGIN_PASSWORD: z.string().optional(),
	},
	emptyStringAsUndefined: true as const,
};

export function createWebEnv(
	runtimeEnv: Record<string, string | number | boolean | undefined>
) {
	return createEnv({ ...webEnvSchema, runtimeEnv });
}

function readImportMetaEnv(): Record<
	string,
	string | number | boolean | undefined
> {
	return (import.meta as unknown as Record<string, unknown>).env as Record<
		string,
		string | number | boolean | undefined
	>;
}

type WebEnv = ReturnType<typeof createWebEnv>;

let cachedEnv: WebEnv | undefined;

/**
 * Lazy `env` proxy: the actual `createEnv` validation happens on first access,
 * so modules that only need the factory (tests, static type tooling) can import
 * `web.ts` without crashing when `import.meta.env` is absent.
 */
export const env = new Proxy({} as WebEnv, {
	get(_target, prop) {
		if (!cachedEnv) {
			cachedEnv = createWebEnv(readImportMetaEnv());
		}
		return cachedEnv[prop as keyof WebEnv];
	},
});
