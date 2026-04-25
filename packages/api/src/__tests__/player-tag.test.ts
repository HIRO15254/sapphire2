import { TAG_COLOR_NAMES } from "@sapphire2/db/constants/player-tag-colors";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("playerTag router structure", () => {
	it("appRouter has playerTag namespace", () => {
		expect(appRouter.playerTag).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.playerTag).sort()).toEqual(
			["create", "delete", "list", "update"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.playerTag.list);
		expectType(appRouter.playerTag.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.playerTag.create,
			appRouter.playerTag.update,
			appRouter.playerTag.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

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

	it("accepts every known tag color", () => {
		for (const color of TAG_COLOR_NAMES) {
			expectAccepts(appRouter.playerTag.create, { name: "tag", color });
		}
	});

	it("rejects unknown color", () => {
		expectRejects(appRouter.playerTag.create, {
			name: "tag",
			color: "neon_pink",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.playerTag.create, { name: "" });
	});

	it("rejects name exceeding 50 characters", () => {
		expectRejects(appRouter.playerTag.create, { name: "a".repeat(51) });
	});

	it("accepts name at exactly 50 characters (boundary)", () => {
		expectAccepts(appRouter.playerTag.create, { name: "a".repeat(50) });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.playerTag.create, { color: "gray" });
	});
});

describe("playerTag.update input validation", () => {
	it("accepts id-only payload (no changes)", () => {
		expectAccepts(appRouter.playerTag.update, { id: "pt1" });
	});

	it("accepts name change", () => {
		expectAccepts(appRouter.playerTag.update, { id: "pt1", name: "regulars" });
	});

	it("accepts color change", () => {
		expectAccepts(appRouter.playerTag.update, {
			id: "pt1",
			color: TAG_COLOR_NAMES[0],
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.playerTag.update, { id: "pt1", name: "" });
	});

	it("rejects name exceeding 50 characters", () => {
		expectRejects(appRouter.playerTag.update, {
			id: "pt1",
			name: "a".repeat(51),
		});
	});

	it("rejects unknown color", () => {
		expectRejects(appRouter.playerTag.update, {
			id: "pt1",
			color: "chartreuse",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.playerTag.update, { name: "x" });
	});
});

describe("playerTag.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.playerTag.delete, { id: "pt1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.playerTag.delete, {});
	});
});
