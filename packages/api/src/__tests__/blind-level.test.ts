import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("blindLevel router", () => {
	it("appRouter has blindLevel namespace", () => {
		expect(appRouter.blindLevel).toBeDefined();
	});

	it("has listByTournament procedure", () => {
		expect(appRouter.blindLevel.listByTournament).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.blindLevel.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.blindLevel.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.blindLevel.delete).toBeDefined();
	});

	it("has reorder procedure", () => {
		expect(appRouter.blindLevel.reorder).toBeDefined();
	});
});
