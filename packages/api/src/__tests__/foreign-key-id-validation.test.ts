import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectRejects } from "./test-utils";

describe("foreign-key id input validation", () => {
	it.each([
		[
			"ring game defaultAssetId",
			appRouter.ringGame.create,
			{ roomId: "room-1", name: "Game", rule: {} },
			"defaultAssetId",
		],
		[
			"tournament defaultAssetId",
			appRouter.tournament.create,
			{ roomId: "room-1", name: "Tournament", rule: {} },
			"defaultAssetId",
		],
	] as const)("rejects an empty %s", (_label, procedure, base, field) => {
		expectRejects(procedure, { ...base, [field]: "" });
	});
});
