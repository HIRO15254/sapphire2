import { TAG_COLOR_NAMES } from "@sapphire2/db/constants/player-tag-colors";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
} from "./test-utils";

const writers = [
	["create", appRouter.playerTag.create, {}],
	["update", appRouter.playerTag.update, { id: "pt1" }],
] as const;

describe("playerTag router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.playerTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.playerTag, {
			create: "mutation",
			delete: "mutation",
			list: "query",
			update: "mutation",
		});
	});
});

describe("playerTag.create input validation", () => {
	it("defaults color to gray when only a name is given", () => {
		const schema = getInputSchema(appRouter.playerTag.create);
		const parsed = schema.safeParse({ name: "friends" }) as unknown as {
			success: true;
			data: { color: string };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.color).toBe("gray");
	});

	it("accepts every known tag color", () => {
		for (const color of TAG_COLOR_NAMES) {
			expectAccepts(appRouter.playerTag.create, { name: "tag", color });
		}
	});
});

describe("playerTag name and color validation", () => {
	it.each(writers)("%s rejects an unknown color", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "tag", color: "neon_pink" });
	});

	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});

	it.each(
		writers
	)("%s accepts a name at exactly 50 characters", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "a".repeat(50) });
	});

	it.each(
		writers
	)("%s rejects a name exceeding 50 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "a".repeat(51) });
	});
});
