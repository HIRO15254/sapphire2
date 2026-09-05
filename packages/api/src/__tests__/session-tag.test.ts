import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectAccepts, expectRejects } from "./test-utils";

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
