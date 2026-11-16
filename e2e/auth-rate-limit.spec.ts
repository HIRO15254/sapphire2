import { API_URL, expect, test } from "./fixtures";

test("the deployed Worker answers 429 to a fourth sign-in from one connecting IP", async ({
	request,
}) => {
	const statuses: number[] = [];
	for (let attempt = 0; attempt < 4; attempt += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Rate-limit assertions depend on request order.
		const response = await request.post(`${API_URL}/api/auth/sign-in/email`, {
			data: { email: "nobody@example.test", password: "wrong-password" },
			headers: {
				Origin: "https://localhost:13001",
				"x-test-client-ip": "203.0.113.70",
			},
		});
		statuses.push(response.status());
	}
	expect(statuses).toEqual([401, 401, 401, 429]);
});
