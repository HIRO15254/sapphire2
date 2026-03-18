import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_SERVER_URL: z.url(),
		VITE_PREVIEW_AUTO_LOGIN: z.string().optional(),
		VITE_PREVIEW_LOGIN_EMAIL: z.string().optional(),
		VITE_PREVIEW_LOGIN_PASSWORD: z.string().optional(),
	},
	runtimeEnv: (import.meta as unknown as Record<string, unknown>).env as Record<
		string,
		string | number | boolean | undefined
	>,
	emptyStringAsUndefined: true,
});
