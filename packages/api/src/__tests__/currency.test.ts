import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("currency router", () => {
	it("appRouter has currency namespace", () => {
		expect(appRouter.currency).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.currency.list).toBeDefined();
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

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.currency).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.currency.list);
		expectType(appRouter.currency.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.currency.create,
			appRouter.currency.update,
			appRouter.currency.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("currency.create input validation", () => {
	it("accepts minimal payload (name only)", () => {
		expectAccepts(appRouter.currency.create, { name: "JPY" });
	});

	it("accepts optional unit string", () => {
		expectAccepts(appRouter.currency.create, { name: "JPY", unit: "¥" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.currency.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.currency.create, {});
	});

	it("rejects non-string name", () => {
		expectRejects(appRouter.currency.create, { name: 123 });
	});
});

describe("currency.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.currency.update, { id: "c1" });
	});

	it("accepts id + name", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", name: "USD" });
	});

	it("accepts id + unit", () => {
		expectAccepts(appRouter.currency.update, { id: "c1", unit: "$" });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.currency.update, { id: "c1", name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.update, { name: "USD" });
	});
});

describe("currency.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.currency.delete, { id: "c1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.currency.delete, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.currency.delete, { id: 42 });
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

	it("has update procedure", () => {
		expect(appRouter.currencyTransaction.update).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.currencyTransaction.delete).toBeDefined();
	});
});
