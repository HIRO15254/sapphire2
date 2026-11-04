import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

describe("ring game input validation", () => {
	it("accepts id-based game selections and validates rule bounds", () => {
		const base = { roomId: "room", name: "Cash", rule: {} };
		for (const game of [
			{ variantId: "variant" },
			{ gameMixId: "mix" },
			{ lineupId: "lineup" },
		]) {
			expectAccepts(appRouter.ringGame.create, { ...base, rule: { game } });
		}
		expectRejects(appRouter.ringGame.create, {
			...base,
			rule: { minBuyIn: 200, maxBuyIn: 100 },
		});
		expectRejects(appRouter.ringGame.create, {
			...base,
			rule: { tableSize: 11 },
		});
		expectRejects(appRouter.ringGame.create, {
			...base,
			rule: { stakes: [{ gameGroupId: "group", blind1: -1 }] },
		});
	});

	it("validates room and lifecycle identifiers", () => {
		expectAccepts(appRouter.ringGame.listByRoom, {
			roomId: "room",
			includeArchived: true,
		});
		expectRejects(appRouter.ringGame.listByRoom, {
			roomId: "room",
			includeArchived: "yes",
		});
		expectRejects(appRouter.ringGame.create, { roomId: "room", name: "" });
		for (const procedure of [
			appRouter.ringGame.archive,
			appRouter.ringGame.restore,
			appRouter.ringGame.delete,
		]) {
			expectRejects(procedure, {});
			expectAccepts(procedure, { id: "game" });
		}
	});
});
