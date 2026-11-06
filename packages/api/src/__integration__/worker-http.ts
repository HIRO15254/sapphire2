import app from "../../../../apps/server/src/worker";
import type { TestD1Database } from "./test-database";

export const SERVER_URL = "http://localhost:8787";
export const WEB_ORIGIN = "http://localhost:3001";

export class CookieJar {
	readonly #cookies = new Map<string, string>();

	store(response: Response): void {
		for (const header of response.headers.getSetCookie()) {
			const [pair] = header.split(";");
			const separator = pair?.indexOf("=") ?? -1;
			if (!pair || separator < 0) {
				continue;
			}
			const name = pair.slice(0, separator).trim();
			const value = pair.slice(separator + 1).trim();
			if (value) {
				this.#cookies.set(name, value);
			} else {
				this.#cookies.delete(name);
			}
		}
	}

	header(): string {
		return [...this.#cookies]
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}
}

export interface WorkerRequestInit {
	body?: string;
	headers?: Record<string, string>;
	jar?: CookieJar;
	method?: string;
}

export type WorkerClient = (
	path: string,
	init?: WorkerRequestInit
) => Promise<Response>;

export function createWorkerClient(d1: TestD1Database): WorkerClient {
	const env = {
		DB: d1,
		BETTER_AUTH_SECRET: "a".repeat(32),
		BETTER_AUTH_URL: SERVER_URL,
		CORS_ORIGIN: WEB_ORIGIN,
		GOOGLE_CLIENT_ID: "google-client-id",
		GOOGLE_CLIENT_SECRET: "google-client-secret",
	};
	return async (path, { jar, headers, ...init } = {}) => {
		const cookie = jar?.header();
		const response = await app.request(
			new URL(path, SERVER_URL).toString(),
			{
				...init,
				headers: { ...headers, ...(cookie ? { cookie } : {}) },
				redirect: "manual",
			},
			env
		);
		jar?.store(response);
		return response;
	};
}

export function jsonPost(
	body: unknown,
	headers: Record<string, string> = {}
): WorkerRequestInit {
	return {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: WEB_ORIGIN,
			...headers,
		},
		body: JSON.stringify(body),
	};
}

export async function signUp(
	request: WorkerClient,
	email: string,
	headers: Record<string, string> = {}
): Promise<CookieJar> {
	const jar = new CookieJar();
	const response = await request("/api/auth/sign-up/email", {
		...jsonPost(
			{ email, password: "correct-horse-battery", name: "Test User" },
			headers
		),
		jar,
	});
	if (response.status !== 200) {
		throw new Error(
			`sign-up failed: ${response.status} ${await response.text()}`
		);
	}
	return jar;
}
