import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("updateNoteView router", () => {
	it("appRouter has updateNoteView namespace", () => {
		expect(appRouter.updateNoteView).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.updateNoteView).sort()).toEqual(
			["getLatestViewedVersion", "list", "markViewed"].sort()
		);
	});

	it("list / getLatestViewedVersion are protected queries", () => {
		expectProtected(appRouter.updateNoteView.list);
		expectType(appRouter.updateNoteView.list, "query");
		expectProtected(appRouter.updateNoteView.getLatestViewedVersion);
		expectType(appRouter.updateNoteView.getLatestViewedVersion, "query");
	});

	it("markViewed is a protected mutation", () => {
		expectProtected(appRouter.updateNoteView.markViewed);
		expectType(appRouter.updateNoteView.markViewed, "mutation");
	});
});

describe("updateNoteView.markViewed input validation", () => {
	it("accepts a non-empty version string", () => {
		expectAccepts(appRouter.updateNoteView.markViewed, { version: "1.2.3" });
	});

	it("rejects empty version", () => {
		expectRejects(appRouter.updateNoteView.markViewed, { version: "" });
	});

	it("rejects missing version", () => {
		expectRejects(appRouter.updateNoteView.markViewed, {});
	});

	it("rejects non-string version", () => {
		expectRejects(appRouter.updateNoteView.markViewed, { version: 1 });
	});
});
