import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("store router", () => {
	it("appRouter has store namespace", () => {
		expect(appRouter.store).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.store.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.store.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.store.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.store.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.store.delete).toBeDefined();
	});
});
