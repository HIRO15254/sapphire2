import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("currency router", () => {
	it("appRouter has currency namespace", () => {
		expect(appRouter.currency).toBeDefined();
	});

	it("has listByStore procedure", () => {
		expect(appRouter.currency.listByStore).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.currency.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.currency.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.currency.delete).toBeDefined();
	});
});

describe("currencyTransaction router", () => {
	it("appRouter has currencyTransaction namespace", () => {
		expect(appRouter.currencyTransaction).toBeDefined();
	});

	it("has listByCurrency procedure", () => {
		expect(appRouter.currencyTransaction.listByCurrency).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.currencyTransaction.create).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.currencyTransaction.delete).toBeDefined();
	});
});
