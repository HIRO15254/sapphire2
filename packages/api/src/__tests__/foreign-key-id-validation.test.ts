import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

describe("foreign-key id input validation", () => {
	it.each([
		[
			"ring game currencyId",
			appRouter.ringGame.create,
			{ roomId: "room-1", name: "Game" },
			"currencyId",
		],
		[
			"tournament currencyId",
			appRouter.tournament.create,
			{ roomId: "room-1", name: "Tournament" },
			"currencyId",
		],
		[
			"tournament with levels currencyId",
			appRouter.tournament.createWithLevels,
			{ roomId: "room-1", name: "Tournament" },
			"currencyId",
		],
	] as const)("rejects an empty %s while accepting a non-empty id and undefined", (_label, procedure, base, field) => {
		expectRejects(procedure, { ...base, [field]: "" });
		expectAccepts(procedure, { ...base, [field]: "linked-id" });
		expectAccepts(procedure, { ...base, [field]: undefined });
	});

	it.each([
		["ring game currencyId", appRouter.ringGame.update, "currencyId"],
		["tournament currencyId", appRouter.tournament.update, "currencyId"],
		[
			"tournament with levels currencyId",
			appRouter.tournament.updateWithLevels,
			"currencyId",
		],
	] as const)("rejects an empty %s while accepting a non-empty id, null clear, and undefined", (_label, procedure, field) => {
		const base =
			procedure === appRouter.tournament.updateWithLevels
				? { id: "id-1", blindLevels: [] }
				: { id: "id-1" };
		expectRejects(procedure, { ...base, [field]: "" });
		expectAccepts(procedure, { ...base, [field]: "linked-id" });
		expectAccepts(procedure, { ...base, [field]: null });
		expectAccepts(procedure, { ...base, [field]: undefined });
	});
});
