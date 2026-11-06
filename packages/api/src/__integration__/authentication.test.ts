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

			const invoke = Reflect.get(guest, path) as (
				input?: unknown
			) => Promise<unknown>;
			await expect(invoke(undefined), path).rejects.toMatchObject({
				code: "UNAUTHORIZED",
			});
		}
	});

	test("healthCheck stays public", async ({ api }) => {
		expect(await api.caller(null).healthCheck()).toBe("OK");
	});
});
