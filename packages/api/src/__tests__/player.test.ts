import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("player router structure", () => {
	it("appRouter has player namespace", () => {
		expect(appRouter.player).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.player).sort()).toEqual(
			["create", "delete", "getById", "list", "update"].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.player.list);
		expectType(appRouter.player.list, "query");
		expectProtected(appRouter.player.getById);
		expectType(appRouter.player.getById, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.player.create,
			appRouter.player.update,
			appRouter.player.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("player.list input validation", () => {
	it("accepts an undefined payload (no filters)", () => {
		expectAccepts(appRouter.player.list, undefined);
	});

	it("accepts an empty object", () => {
		expectAccepts(appRouter.player.list, {});
	});

	it("accepts search string", () => {
		expectAccepts(appRouter.player.list, { search: "alice" });
	});

	it("accepts tagIds array", () => {
		expectAccepts(appRouter.player.list, { tagIds: ["t1", "t2"] });
	});

	it("accepts both search and tagIds together", () => {
		expectAccepts(appRouter.player.list, {
			search: "bob",
			tagIds: ["t1"],
		});
	});

	it("rejects non-string search", () => {
		expectRejects(appRouter.player.list, { search: 42 });
	});

	it("rejects non-array tagIds", () => {
		expectRejects(appRouter.player.list, { tagIds: "t1" });
	});
});

describe("player.getById input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.player.getById, { id: "p1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.getById, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.player.getById, { id: 1 });
	});
});

describe("player.create input validation", () => {
	it("accepts minimal valid payload (name only)", () => {
		expectAccepts(appRouter.player.create, { name: "Alice" });
	});

	it("accepts full payload with memo and tagIds", () => {
		expectAccepts(appRouter.player.create, {
			name: "Alice",
			memo: "notes",
			tagIds: ["t1", "t2"],
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.player.create, { name: "" });
	});

	it("rejects name exceeding max length (100)", () => {
		expectRejects(appRouter.player.create, { name: "a".repeat(101) });
	});

	it("accepts name at exactly 100 characters (boundary)", () => {
		expectAccepts(appRouter.player.create, { name: "a".repeat(100) });
	});

	it("rejects memo exceeding 50_000 characters", () => {
		expectRejects(appRouter.player.create, {
			name: "Alice",
			memo: "a".repeat(50_001),
		});
	});

	it("accepts memo at exactly 50_000 characters (boundary)", () => {
		expectAccepts(appRouter.player.create, {
			name: "Alice",
			memo: "a".repeat(50_000),
		});
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.player.create, { memo: "x" });
	});
});

describe("player.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.player.update, { id: "p1" });
	});

	it("accepts name update", () => {
		expectAccepts(appRouter.player.update, { id: "p1", name: "Bob" });
	});

	it("accepts explicit memo: null", () => {
		expectAccepts(appRouter.player.update, { id: "p1", memo: null });
	});

	it("accepts tagIds replacement including empty array", () => {
		expectAccepts(appRouter.player.update, { id: "p1", tagIds: [] });
		expectAccepts(appRouter.player.update, {
			id: "p1",
			tagIds: ["t1", "t2"],
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.player.update, { id: "p1", name: "" });
	});

	it("rejects name exceeding max length (100)", () => {
		expectRejects(appRouter.player.update, {
			id: "p1",
			name: "a".repeat(101),
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.update, { name: "Bob" });
	});
});

describe("player.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.player.delete, { id: "p1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.delete, {});
	});
});
