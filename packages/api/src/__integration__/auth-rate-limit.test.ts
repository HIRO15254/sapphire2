import { afterAll, expect, vi } from "vitest";
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

test("a client rotating X-Forwarded-For still exhausts the sign-in limit of its Cloudflare connecting IP", async ({
	api,
}) => {
	const request = createWorkerClient(api.d1);
	const statuses: number[] = [];
	for (const forwardedFor of [
		"198.51.100.1",
		"198.51.100.2",
		"198.51.100.3",
		"198.51.100.4",
	]) {
		// biome-ignore lint/performance/noAwaitInLoops: Rate-limit assertions depend on request order.
		const response = await request(
			"/api/auth/sign-in/email",
			jsonPost(
				{ email: "nobody@example.test", password: "wrong-password" },
				{ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": forwardedFor }
			)
		);
		statuses.push(response.status);
	}
	expect(statuses.slice(0, 3)).not.toContain(429);
	expect(statuses[3]).toBe(429);

	const otherClient = await request(
		"/api/auth/sign-in/email",
		jsonPost(
			{ email: "nobody@example.test", password: "wrong-password" },
			{ "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.51.100.1" }
		)
	);
	expect(otherClient.status).not.toBe(429);
});
