import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("aiExtract router", () => {
	it("appRouter has aiExtract namespace", () => {
		expect(appRouter.aiExtract).toBeDefined();
	});

	it("has extractTournamentData procedure", () => {
		expect(appRouter.aiExtract.extractTournamentData).toBeDefined();
	});

	it("has extractTablePlayers procedure", () => {
		expect(appRouter.aiExtract.extractTablePlayers).toBeDefined();
	});
});
