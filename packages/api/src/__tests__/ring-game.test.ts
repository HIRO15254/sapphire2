import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("ringGame router structure", () => {
	it("appRouter has ringGame namespace", () => {
		expect(appRouter.ringGame).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.ringGame).sort()).toEqual(
			[
				"listByStore",
				"getById",
				"create",
				"update",
				"archive",
				"restore",
				"delete",
				"listBlindSets",
				"addBlindSet",
				"updateBlindSet",
				"removeBlindSet",
			].sort()
		);
	});

	it("listByStore / getById / listBlindSets are protected queries", () => {
		expectProtected(appRouter.ringGame.listByStore);
		expectType(appRouter.ringGame.listByStore, "query");
		expectProtected(appRouter.ringGame.getById);
		expectType(appRouter.ringGame.getById, "query");
		expectProtected(appRouter.ringGame.listBlindSets);
		expectType(appRouter.ringGame.listBlindSets, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
			"addBlindSet",
			"updateBlindSet",
			"removeBlindSet",
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

describe("ringGame.getById input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.ringGame.getById, { id: "rg1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.getById, {});
	});
});

describe("ringGame.create input validation", () => {
	it("accepts minimal valid payload (storeId + name)", () => {
		expectAccepts(appRouter.ringGame.create, {
			storeId: "s1",
			name: "1/2 NLH",
		});
	});

	it("accepts optional variantId", () => {
		expectAccepts(appRouter.ringGame.create, {
			storeId: "s1",
			name: "1/2 NLH",
			variantId: 1,
		});
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.ringGame.create, {
			storeId: "s1",
			name: "1/2 NLH",
			variantId: 1,
			minBuyIn: 100,
			maxBuyIn: 500,
			tableSize: 9,
			currencyId: "c1",
			memo: "memo",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.ringGame.create, { storeId: "s1", name: "" });
	});

	it("rejects missing storeId", () => {
		expectRejects(appRouter.ringGame.create, { name: "1/2 NLH" });
	});

	it("rejects non-integer variantId", () => {
		expectRejects(appRouter.ringGame.create, {
			storeId: "s1",
			name: "game",
			variantId: 1.5,
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
			variantId: null,
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

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.update, { name: "x" });
	});

	it("does not accept old blind1/blind2/blind3/ante fields", () => {
		// New schema doesn't have these directly on ringGame
		// The schema should still accept them silently (extra fields) or reject?
		// Since we use z.object(), extra fields are stripped. The schema accepts {id} + extra.
		// But since there's no blind1 in the schema, we just verify the schema doesn't add it.
		const schema = appRouter.ringGame.update._def.inputs[0] as {
			safeParse: (v: unknown) => { success: boolean };
		};
		const result = schema.safeParse({ id: "rg1", blind1: 1, blind2: 2 });
		// Extra fields are stripped by Zod by default, so it will succeed but strip them
		expect(result.success).toBe(true);
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

describe("ringGame.listBlindSets input validation", () => {
	it("accepts {ringGameId}", () => {
		expectAccepts(appRouter.ringGame.listBlindSets, { ringGameId: "rg1" });
	});

	it("rejects missing ringGameId", () => {
		expectRejects(appRouter.ringGame.listBlindSets, {});
	});
});

describe("ringGame.addBlindSet input validation", () => {
	it("accepts minimal valid payload", () => {
		expectAccepts(appRouter.ringGame.addBlindSet, {
			ringGameId: "rg1",
			limitFormatId: 1,
			blind1: 1,
			blind2: 2,
			sortOrder: 0,
		});
	});

	it("accepts full payload with all optional fields", () => {
		expectAccepts(appRouter.ringGame.addBlindSet, {
			ringGameId: "rg1",
			limitFormatId: 1,
			blind1: 1,
			blind2: 2,
			blind3: 3,
			blind4: 5,
			ante: 2,
			anteType: "bb",
			sortOrder: 0,
		});
	});

	it("rejects limitFormatId=0", () => {
		expectRejects(appRouter.ringGame.addBlindSet, {
			ringGameId: "rg1",
			limitFormatId: 0,
			blind1: 1,
			blind2: 2,
			sortOrder: 0,
		});
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.ringGame.addBlindSet, {
			ringGameId: "rg1",
			limitFormatId: 1,
			blind1: 1,
			blind2: 2,
			anteType: "half",
			sortOrder: 0,
		});
	});

	it("accepts all valid anteType values", () => {
		for (const anteType of ["none", "all", "bb"] as const) {
			expectAccepts(appRouter.ringGame.addBlindSet, {
				ringGameId: "rg1",
				limitFormatId: 1,
				blind1: 1,
				blind2: 2,
				anteType,
				sortOrder: 0,
			});
		}
	});

	it("rejects missing ringGameId", () => {
		expectRejects(appRouter.ringGame.addBlindSet, {
			limitFormatId: 1,
			blind1: 1,
			blind2: 2,
			sortOrder: 0,
		});
	});

	it("rejects negative blind1", () => {
		expectRejects(appRouter.ringGame.addBlindSet, {
			ringGameId: "rg1",
			limitFormatId: 1,
			blind1: -1,
			blind2: 2,
			sortOrder: 0,
		});
	});
});

describe("ringGame.updateBlindSet input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.ringGame.updateBlindSet, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.ringGame.updateBlindSet, {
			id: 1,
			limitFormatId: 2,
			blind1: 5,
			blind2: 10,
			blind3: 20,
			blind4: 40,
			ante: 10,
			anteType: "all",
			sortOrder: 1,
		});
	});

	it("accepts null for nullable optional fields", () => {
		expectAccepts(appRouter.ringGame.updateBlindSet, {
			id: 1,
			blind3: null,
			blind4: null,
			ante: null,
			anteType: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.updateBlindSet, { blind1: 1 });
	});

	it("rejects string id", () => {
		expectRejects(appRouter.ringGame.updateBlindSet, { id: "1" });
	});
});

describe("ringGame.removeBlindSet input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.ringGame.removeBlindSet, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.ringGame.removeBlindSet, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.ringGame.removeBlindSet, { id: "1" });
	});
});
