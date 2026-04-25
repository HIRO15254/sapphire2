import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

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

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.transactionType).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.transactionType.list);
		expectType(appRouter.transactionType.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.transactionType.create,
			appRouter.transactionType.update,
			appRouter.transactionType.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("transactionType.create input validation", () => {
	it("accepts a non-empty name", () => {
		expectAccepts(appRouter.transactionType.create, { name: "Bonus" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.transactionType.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.transactionType.create, {});
	});

	it("rejects non-string name", () => {
		expectRejects(appRouter.transactionType.create, { name: 123 });
	});
});

describe("transactionType.update input validation", () => {
	it("accepts {id, name}", () => {
		expectAccepts(appRouter.transactionType.update, {
			id: "tt1",
			name: "Renamed",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.transactionType.update, {
			id: "tt1",
			name: "",
		});
	});

	it("rejects missing name (required here unlike tag routers)", () => {
		expectRejects(appRouter.transactionType.update, { id: "tt1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.transactionType.update, { name: "x" });
	});
});

describe("transactionType.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.transactionType.delete, { id: "tt1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.transactionType.delete, {});
	});
});
