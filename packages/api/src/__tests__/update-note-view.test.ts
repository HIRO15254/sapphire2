import { describe, it } from "vitest";
import { appRouter } from "../routers";
import { expectRejects } from "./test-utils";

describe("updateNoteView.markViewed input validation", () => {
	it("rejects empty version", () => {
		expectRejects(appRouter.updateNoteView.markViewed, { version: "" });
	});
});
