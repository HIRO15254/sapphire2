import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

describe("sessionTag router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.sessionTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.sessionTag, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("sessionTag.create input validation", () => {
	it("accepts a non-empty name", () => {
		expectAccepts(appRouter.sessionTag.create, { name: "bankroll" });
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.sessionTag.create, { name: "" });
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
});
