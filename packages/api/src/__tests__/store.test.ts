import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

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

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.store).sort()).toEqual(
			["create", "delete", "getById", "list", "update"].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.store.list);
		expectType(appRouter.store.list, "query");
		expectProtected(appRouter.store.getById);
		expectType(appRouter.store.getById, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.store.create,
			appRouter.store.update,
			appRouter.store.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("store.getById input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.store.getById, { id: "s1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.store.getById, {});
	});
});

describe("store.create input validation", () => {
	it("accepts minimal payload (name only)", () => {
		expectAccepts(appRouter.store.create, { name: "Casino Tokyo" });
	});

	it("accepts name + memo", () => {
		expectAccepts(appRouter.store.create, {
			name: "Casino Tokyo",
			memo: "weekly visits",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.store.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.store.create, {});
	});

	it("rejects non-string memo", () => {
		expectRejects(appRouter.store.create, {
			name: "x",
			memo: 123,
		});
	});
});

describe("store.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.store.update, { id: "s1" });
	});

	it("accepts name change", () => {
		expectAccepts(appRouter.store.update, { id: "s1", name: "Renamed" });
	});

	it("accepts memo change", () => {
		expectAccepts(appRouter.store.update, { id: "s1", memo: "new memo" });
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.store.update, { id: "s1", name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.store.update, { name: "x" });
	});
});

describe("store.delete input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.store.delete, { id: "s1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.store.delete, {});
	});
});
