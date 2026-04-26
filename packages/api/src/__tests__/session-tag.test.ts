import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("sessionTag router structure", () => {
	it("appRouter has sessionTag namespace", () => {
		expect(appRouter.sessionTag).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.sessionTag.list);
		expectType(appRouter.sessionTag.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.sessionTag.create,
			appRouter.sessionTag.update,
			appRouter.sessionTag.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("sessionTag.create input validation", () => {
	it("accepts a non-empty name", () => {
		expectAccepts(appRouter.sessionTag.create, { name: "bankroll" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.sessionTag.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.sessionTag.create, {});
	});

	it("rejects non-string name", () => {
		expectRejects(appRouter.sessionTag.create, { name: 123 });
	});
});

describe("sessionTag.update input validation", () => {
	it("accepts id + name", () => {
		expectAccepts(appRouter.sessionTag.update, {
			id: "st1",
			name: "renamed",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.sessionTag.update, { id: "st1", name: "" });
	});

	it("rejects missing name (unlike similar tag routers, update requires name)", () => {
		expectRejects(appRouter.sessionTag.update, { id: "st1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.sessionTag.update, { name: "x" });
	});
});

describe("sessionTag.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.sessionTag.delete, { id: "st1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.sessionTag.delete, {});
	});
});
