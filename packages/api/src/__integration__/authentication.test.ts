import { describe, expect } from "vitest";
import { appRouter } from "../routers";
import { test } from "./test-fixture";

describe("API authentication contract", () => {
	test("every procedure except healthCheck rejects an unauthenticated invocation", async ({
		api,
	}) => {
		const guest = api.caller(null);
		for (const path of Object.keys(appRouter._def.procedures)) {
			if (path === "healthCheck") {
				continue;
			}
			// Auth precedes procedure input parsing. BAD_REQUEST, a DB error, or
			// any other rejection must fail this assertion, not count as auth.
			const invoke = Reflect.get(guest, path) as (
				input?: unknown
			) => Promise<unknown>;
			await expect(invoke(undefined), path).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		}
	});

	test("the shared middleware denies guests and returns only the authenticated account identity", async ({
		api,
	}) => {
		expect(await api.caller(null).healthCheck()).toBe("OK");
		await expect(api.caller(null).privateData()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
			message: "Authentication required",
		});
		expect(await api.alice.privateData()).toMatchObject({
			user: { id: "alice", email: "alice@example.test" },
		});
		expect(await api.bob.privateData()).toMatchObject({
			user: { id: "bob", email: "bob@example.test" },
		});
	});
});
