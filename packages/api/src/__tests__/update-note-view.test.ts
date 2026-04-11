import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";

describe("updateNoteView router", () => {
	it("appRouter has updateNoteView namespace", () => {
		expect(appRouter.updateNoteView).toBeDefined();
	});
});
