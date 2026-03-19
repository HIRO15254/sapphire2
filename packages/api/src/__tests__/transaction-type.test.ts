import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("transactionType router", () => {
	it("appRouter has transactionType namespace", () => {
		expect(appRouter.transactionType).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.transactionType.list).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.transactionType.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.transactionType.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.transactionType.delete).toBeDefined();
	});
});
