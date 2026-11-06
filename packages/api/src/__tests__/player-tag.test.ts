import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { expectRejects, getInputSchema } from "./test-utils";

describe("playerTag.create input validation", () => {
	it("accepts name only (color defaults to gray)", () => {
		const schema = getInputSchema(appRouter.playerTag.create);
		const parsed = schema.safeParse({ name: "friends" }) as unknown as {
			success: true;
			data: { color: string };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.color).toBe("gray");
	});

	it("rejects unknown color", () => {
		expectRejects(appRouter.playerTag.create, {
			name: "tag",
			color: "neon_pink",
		});
	});
});

describe("playerTag.update input validation", () => {
	it("rejects an id-only payload, which would change nothing", () => {
		expectRejects(appRouter.playerTag.update, { id: "pt1" });
	});

	it("rejects unknown color", () => {
		expectRejects(appRouter.playerTag.update, {
			id: "pt1",
			color: "chartreuse",
		});
	});
});
