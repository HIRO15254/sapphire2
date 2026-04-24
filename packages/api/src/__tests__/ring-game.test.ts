import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("ringGame router", () => {
	it("appRouter has ringGame namespace", () => {
		expect(appRouter.ringGame).toBeDefined();
	});

	it("has listByStore procedure", () => {
		expect(appRouter.ringGame.listByStore).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.ringGame.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.ringGame.update).toBeDefined();
	});

	it("has archive procedure", () => {
		expect(appRouter.ringGame.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.ringGame.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.ringGame.delete).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.ringGame).sort()).toEqual(
			["archive", "create", "delete", "listByStore", "restore", "update"].sort()
		);
	});

	it("listByStore is a protected query", () => {
		expectProtected(appRouter.ringGame.listByStore);
		expectType(appRouter.ringGame.listByStore, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
		] as const) {
			const proc = appRouter.ringGame[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("ringGame.listByStore input validation", () => {
	it("accepts storeId only", () => {
		expectAccepts(appRouter.ringGame.listByStore, { storeId: "s1" });
	});

	it("accepts includeArchived: true/false", () => {
		expectAccepts(appRouter.ringGame.listByStore, {
			storeId: "s1",
			includeArchived: true,
		});
		expectAccepts(appRouter.ringGame.listByStore, {
			storeId: "s1",
			includeArchived: false,
		});
	});

	it("rejects missing storeId", () => {
		expectRejects(appRouter.ringGame.listByStore, {});
	});

	it("rejects non-boolean includeArchived", () => {
		expectRejects(appRouter.ringGame.listByStore, {
			storeId: "s1",
			includeArchived: "yes",
		});
	});
});

describe("ringGame.create input validation", () => {
	it("accepts minimal valid payload (storeId + name), variant defaults to nlh", () => {
		const schema = getInputSchema(appRouter.ringGame.create);
		const parsed = schema.safeParse({
			storeId: "s1",
			name: "1/2 NLH",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("nlh");
	});

	it("accepts all anteType values", () => {
		for (const anteType of ["none", "all", "bb"] as const) {
			expectAccepts(appRouter.ringGame.create, {
				storeId: "s1",
				name: "game",
				anteType,
			});
		}
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.ringGame.create, {
			storeId: "s1",
			name: "game",
			anteType: "double",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.ringGame.create, { storeId: "s1", name: "" });
	});

	it("rejects non-integer blind1", () => {
		expectRejects(appRouter.ringGame.create, {
			storeId: "s1",
			name: "g",
			blind1: 1.5,
		});
	});
});

describe("ringGame.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.ringGame.update, { id: "rg1" });
	});

	it("accepts nullable fields set to null", () => {
		expectAccepts(appRouter.ringGame.update, {
			id: "rg1",
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: null,
			currencyId: null,
			memo: null,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.ringGame.update, { id: "rg1", name: "" });
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.ringGame.update, {
			id: "rg1",
			anteType: "straddle",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.update, { name: "x" });
	});
});

describe("ringGame.{archive,restore,delete} input validation", () => {
	it("archive accepts {id}", () => {
		expectAccepts(appRouter.ringGame.archive, { id: "rg1" });
	});

	it("restore accepts {id}", () => {
		expectAccepts(appRouter.ringGame.restore, { id: "rg1" });
	});

	it("delete accepts {id}", () => {
		expectAccepts(appRouter.ringGame.delete, { id: "rg1" });
	});

	it("archive / restore / delete reject missing id", () => {
		expectRejects(appRouter.ringGame.archive, {});
		expectRejects(appRouter.ringGame.restore, {});
		expectRejects(appRouter.ringGame.delete, {});
	});
});
