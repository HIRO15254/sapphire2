import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("aiExtractPlayers router", () => {
	it("appRouter has aiExtractPlayers namespace", () => {
		expect(appRouter.aiExtractPlayers).toBeDefined();
	});

	it("has extractPlayerNames procedure", () => {
		expect(appRouter.aiExtractPlayers.extractPlayerNames).toBeDefined();
	});
});
