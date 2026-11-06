import { afterAll, expect, vi } from "vitest";
import type { TestD1Database } from "./test-database";
import { test } from "./test-fixture";
import { createWorkerClient, jsonPost } from "./worker-http";

const previousNodeEnv = vi.hoisted(() => {
	const previous = process.env.NODE_ENV;
	process.env.NODE_ENV = "production";
	return previous;
});

afterAll(() => {
	process.env.NODE_ENV = previousNodeEnv;
});

const REGISTER_PATH = "/api/auth/oauth2/register";
const MAX_BODY_BYTES = 16 * 1024;

function registration(uris: string[], clientName = "Limit test") {
	return {
		client_name: clientName,
		redirect_uris: uris,
		token_endpoint_auth_method: "none",
	};
}

function redirectUris(count: number): string[] {
	return Array.from(
		{ length: count },
		(_, index) => `http://localhost:9999/callback/${index}`
	);
}

function registrationOfSize(bytes: number) {
	const base = JSON.stringify(registration(redirectUris(1), ""));
	return registration(redirectUris(1), "x".repeat(bytes - base.length));
}

async function clientCount(d1: TestD1Database): Promise<number> {
	return (await d1.prepare("SELECT id FROM oauth_client").all()).results.length;
}

test.for([
	{ bytes: MAX_BODY_BYTES, clients: 1, status: 201 },
	{ bytes: MAX_BODY_BYTES + 1, clients: 0, status: 413 },
])(
	"a $bytes-byte registration body answers $status",
	async ({ bytes, status, clients }, { api }) => {
		const request = createWorkerClient(api.d1);
		const body = registrationOfSize(bytes);
		expect(new TextEncoder().encode(JSON.stringify(body)).length).toBe(bytes);
		const response = await request(
			REGISTER_PATH,
			jsonPost(body, { "cf-connecting-ip": `198.51.100.${bytes % 200}` })
		);
		expect(response.status).toBe(status);
		expect(await clientCount(api.d1)).toBe(clients);
	}
);

test.for([
	{ clients: 1, count: 10, status: 201 },
	{ clients: 0, count: 11, status: 400 },
])(
	"registering $count redirect URIs answers $status",
	async ({ count, status, clients }, { api }) => {
		const request = createWorkerClient(api.d1);
		const response = await request(
			REGISTER_PATH,
			jsonPost(registration(redirectUris(count)), {
				"cf-connecting-ip": `198.51.100.2${count}`,
			})
		);
		expect(response.status).toBe(status);
		expect(await clientCount(api.d1)).toBe(clients);
	}
);

test("one connecting IP registers at most 20 clients per hour", async ({
	api,
}) => {
	const request = createWorkerClient(api.d1);
	const statuses: number[] = [];
	for (let attempt = 0; attempt < 21; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Rate-limit requests must remain sequential.
		const response = await request(
			REGISTER_PATH,
			jsonPost(registration(redirectUris(1)), {
				"cf-connecting-ip": "203.0.113.40",
				"x-forwarded-for": `198.51.100.${attempt}`,
			})
		);
		statuses.push(response.status);
	}
	expect(statuses.slice(0, 20)).toEqual(new Array(20).fill(201));
	expect(statuses[20]).toBe(429);
	expect(await clientCount(api.d1)).toBe(20);

	const otherClient = await request(
		REGISTER_PATH,
		jsonPost(registration(redirectUris(1)), {
			"cf-connecting-ip": "203.0.113.41",
		})
	);
	expect(otherClient.status).toBe(201);
});
