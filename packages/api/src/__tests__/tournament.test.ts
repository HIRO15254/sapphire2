import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("tournament router", () => {
	it("appRouter has tournament namespace", () => {
		expect(appRouter.tournament).toBeDefined();
	});

	it("has listByStore procedure", () => {
		expect(appRouter.tournament.listByStore).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.tournament.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.tournament.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.tournament.update).toBeDefined();
	});

	it("has archive procedure", () => {
		expect(appRouter.tournament.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.tournament.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.tournament.delete).toBeDefined();
	});
});
