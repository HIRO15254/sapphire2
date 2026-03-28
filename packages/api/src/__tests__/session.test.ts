import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("session router", () => {
	it("appRouter has session namespace", () => {
		expect(appRouter.session).toBeDefined();
	});
});
