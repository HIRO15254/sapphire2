/** Shared fakes for worker route tests (no real D1 behind them). */

export interface FakeEnv {
	ANTHROPIC_API_KEY?: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
	DB: unknown;
	DISCORD_CLIENT_ID?: string;
	DISCORD_CLIENT_SECRET?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	GOOGLE_MAPS_API_KEY?: string;
}

/**
 * Minimal env satisfying serverEnvSchema. DB is a stub — tests using it may
 * only exercise paths that never reach a real query.
 */
export function createFakeEnv(overrides: Partial<FakeEnv> = {}): FakeEnv {
	return {
		BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars-long",
		BETTER_AUTH_URL: "http://localhost:8787",
		CORS_ORIGIN: "http://localhost:3001",
		DB: {},
		...overrides,
	};
}
