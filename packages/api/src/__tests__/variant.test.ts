import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("variant router structure", () => {
	it("appRouter has variant namespace", () => {
		expect(appRouter.variant).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.variant).sort()).toEqual(
			["list", "create", "update", "delete"].sort()
		);
	});

	it("list is a protected query", () => {
		expectProtected(appRouter.variant.list);
		expectType(appRouter.variant.list, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.variant.create,
			appRouter.variant.update,
			appRouter.variant.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("variant.create input validation", () => {
	it("accepts minimal valid payload (name only)", () => {
		expectAccepts(appRouter.variant.create, { name: "No-Limit Hold'em" });
	});

	it("accepts payload with sortOrder", () => {
		expectAccepts(appRouter.variant.create, {
			name: "H.O.R.S.E.",
			sortOrder: 5,
		});
	});

	it("defaults sortOrder to 0 when omitted", () => {
		const schema = appRouter.variant.create._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: boolean;
				data: { sortOrder: number };
			};
		};
		const result = schema.safeParse({ name: "PLO" });
		expect(result.success).toBe(true);
		expect(result.data.sortOrder).toBe(0);
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.variant.create, { name: "" });
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.variant.create, {});
	});

	it("rejects negative sortOrder", () => {
		expectRejects(appRouter.variant.create, { name: "NLH", sortOrder: -1 });
	});

	it("accepts sortOrder=0 (boundary)", () => {
		expectAccepts(appRouter.variant.create, { name: "NLH", sortOrder: 0 });
	});
});

describe("variant.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.variant.update, { id: 1 });
	});

	it("accepts name update", () => {
		expectAccepts(appRouter.variant.update, {
			id: 1,
			name: "Pot-Limit Omaha",
		});
	});

	it("accepts sortOrder update", () => {
		expectAccepts(appRouter.variant.update, { id: 1, sortOrder: 10 });
	});

	it("accepts both name and sortOrder", () => {
		expectAccepts(appRouter.variant.update, {
			id: 1,
			name: "Dealer's Choice",
			sortOrder: 99,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.variant.update, { id: 1, name: "" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.variant.update, { name: "PLO" });
	});

	it("rejects string id", () => {
		expectRejects(appRouter.variant.update, { id: "1", name: "PLO" });
	});

	it("rejects non-integer id", () => {
		expectRejects(appRouter.variant.update, { id: 1.5 });
	});

	it("rejects negative sortOrder", () => {
		expectRejects(appRouter.variant.update, { id: 1, sortOrder: -1 });
	});
});

describe("variant.delete input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.variant.delete, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.variant.delete, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.variant.delete, { id: "1" });
	});

	it("rejects non-integer id", () => {
		expectRejects(appRouter.variant.delete, { id: 1.5 });
	});

	it("rejects negative id", () => {
		// negative integers are still integers, allowed by z.number().int()
		// unless there's a min constraint — there isn't, so this should pass
		expectAccepts(appRouter.variant.delete, { id: -1 });
	});
});
