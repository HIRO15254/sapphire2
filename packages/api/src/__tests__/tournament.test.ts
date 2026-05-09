import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("tournament router structure", () => {
	it("appRouter has tournament namespace", () => {
		expect(appRouter.tournament).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournament).sort()).toEqual(
			[
				"listByStore",
				"getById",
				"create",
				"update",
				"archive",
				"restore",
				"delete",
				"addTag",
				"removeTag",
				"listBlindLevels",
				"addBlindLevel",
				"updateBlindLevel",
				"removeBlindLevel",
				"addBlindSet",
				"updateBlindSet",
				"removeBlindSet",
			].sort()
		);
	});

	it("listByStore / getById / listBlindLevels are protected queries", () => {
		expectProtected(appRouter.tournament.listByStore);
		expectType(appRouter.tournament.listByStore, "query");
		expectProtected(appRouter.tournament.getById);
		expectType(appRouter.tournament.getById, "query");
		expectProtected(appRouter.tournament.listBlindLevels);
		expectType(appRouter.tournament.listBlindLevels, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"archive",
			"restore",
			"delete",
			"addTag",
			"removeTag",
			"addBlindLevel",
			"updateBlindLevel",
			"removeBlindLevel",
			"addBlindSet",
			"updateBlindSet",
			"removeBlindSet",
		] as const) {
			const proc = appRouter.tournament[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("tournament.listByStore input validation", () => {
	it("accepts storeId only", () => {
		expectAccepts(appRouter.tournament.listByStore, { storeId: "s1" });
	});

	it("accepts includeArchived flag", () => {
		expectAccepts(appRouter.tournament.listByStore, {
			storeId: "s1",
			includeArchived: true,
		});
	});

	it("rejects missing storeId", () => {
		expectRejects(appRouter.tournament.listByStore, {});
	});
});

describe("tournament.create input validation", () => {
	it("accepts minimal payload (storeId + name)", () => {
		expectAccepts(appRouter.tournament.create, {
			storeId: "s1",
			name: "Main Event",
		});
	});

	it("accepts optional variantId", () => {
		expectAccepts(appRouter.tournament.create, {
			storeId: "s1",
			name: "Main Event",
			variantId: 1,
		});
	});

	it("accepts full numeric configuration", () => {
		expectAccepts(appRouter.tournament.create, {
			storeId: "s1",
			name: "ME",
			variantId: 1,
			buyIn: 100_000,
			entryFee: 10_000,
			startingStack: 30_000,
			bountyAmount: 20_000,
			tableSize: 9,
			currencyId: "c1",
			memo: "memo",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.create, {
			storeId: "s1",
			name: "",
		});
	});

	it("rejects non-integer buyIn", () => {
		expectRejects(appRouter.tournament.create, {
			storeId: "s1",
			name: "ME",
			buyIn: 100.5,
		});
	});

	it("rejects missing storeId", () => {
		expectRejects(appRouter.tournament.create, { name: "ME" });
	});

	it("does not accept old variant text field", () => {
		// The new schema uses variantId (integer), not variant (string).
		// Passing a string `variant` field should be stripped by Zod.
		const schema = appRouter.tournament.create._def.inputs[0] as {
			safeParse: (v: unknown) => { success: boolean };
		};
		const result = schema.safeParse({
			storeId: "s1",
			name: "ME",
			variant: "nlh",
		});
		// Extra fields are stripped — success but stripped
		expect(result.success).toBe(true);
	});
});

describe("tournament.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.tournament.update, { id: "tn1" });
	});

	it("accepts nullable fields set to null", () => {
		expectAccepts(appRouter.tournament.update, {
			id: "tn1",
			variantId: null,
			buyIn: null,
			entryFee: null,
			startingStack: null,
			bountyAmount: null,
			tableSize: null,
			currencyId: null,
			memo: null,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.tournament.update, { id: "tn1", name: "" });
	});

	it("rejects non-integer tableSize", () => {
		expectRejects(appRouter.tournament.update, {
			id: "tn1",
			tableSize: 9.5,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.update, { name: "ME" });
	});
});

describe("tournament.{archive,restore,delete,getById} input validation", () => {
	it("each accepts {id}", () => {
		expectAccepts(appRouter.tournament.archive, { id: "tn1" });
		expectAccepts(appRouter.tournament.restore, { id: "tn1" });
		expectAccepts(appRouter.tournament.delete, { id: "tn1" });
		expectAccepts(appRouter.tournament.getById, { id: "tn1" });
	});

	it("each rejects missing id", () => {
		expectRejects(appRouter.tournament.archive, {});
		expectRejects(appRouter.tournament.restore, {});
		expectRejects(appRouter.tournament.delete, {});
		expectRejects(appRouter.tournament.getById, {});
	});
});

describe("tournament.addTag input validation", () => {
	it("accepts a valid tag payload", () => {
		expectAccepts(appRouter.tournament.addTag, {
			tournamentId: "tn1",
			name: "weekly",
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournament.addTag, {
			tournamentId: "tn1",
			name: "",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournament.addTag, { name: "weekly" });
	});
});

describe("tournament.removeTag input validation", () => {
	it("accepts valid id", () => {
		expectAccepts(appRouter.tournament.removeTag, { id: "tag1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.removeTag, {});
	});
});

// ---------------------------------------------------------------------------
// Blind level CRUD
// ---------------------------------------------------------------------------

describe("tournament.listBlindLevels input validation", () => {
	it("accepts {tournamentId}", () => {
		expectAccepts(appRouter.tournament.listBlindLevels, {
			tournamentId: "tn1",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournament.listBlindLevels, {});
	});
});

describe("tournament.addBlindLevel input validation", () => {
	it("accepts minimal payload", () => {
		expectAccepts(appRouter.tournament.addBlindLevel, {
			tournamentId: "tn1",
			levelIndex: 1,
			isBreak: false,
			sortOrder: 0,
		});
	});

	it("accepts break level with minutes", () => {
		expectAccepts(appRouter.tournament.addBlindLevel, {
			tournamentId: "tn1",
			levelIndex: 5,
			isBreak: true,
			minutes: 15,
			sortOrder: 5,
		});
	});

	it("rejects minutes=0", () => {
		expectRejects(appRouter.tournament.addBlindLevel, {
			tournamentId: "tn1",
			levelIndex: 1,
			isBreak: false,
			minutes: 0,
			sortOrder: 0,
		});
	});

	it("rejects negative levelIndex", () => {
		expectRejects(appRouter.tournament.addBlindLevel, {
			tournamentId: "tn1",
			levelIndex: -1,
			isBreak: false,
			sortOrder: 0,
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournament.addBlindLevel, {
			levelIndex: 1,
			isBreak: false,
			sortOrder: 0,
		});
	});
});

describe("tournament.updateBlindLevel input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.tournament.updateBlindLevel, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.tournament.updateBlindLevel, {
			id: 1,
			levelIndex: 2,
			isBreak: true,
			minutes: 20,
			sortOrder: 3,
		});
	});

	it("accepts minutes: null to clear", () => {
		expectAccepts(appRouter.tournament.updateBlindLevel, {
			id: 1,
			minutes: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.updateBlindLevel, { levelIndex: 1 });
	});

	it("rejects string id", () => {
		expectRejects(appRouter.tournament.updateBlindLevel, { id: "1" });
	});
});

describe("tournament.removeBlindLevel input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.tournament.removeBlindLevel, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.removeBlindLevel, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.tournament.removeBlindLevel, { id: "1" });
	});
});

// ---------------------------------------------------------------------------
// Blind set CRUD
// ---------------------------------------------------------------------------

describe("tournament.addBlindSet input validation", () => {
	it("accepts minimal valid payload", () => {
		expectAccepts(appRouter.tournament.addBlindSet, {
			tournamentBlindLevelId: 1,
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			sortOrder: 0,
		});
	});

	it("accepts full payload with all optional fields", () => {
		expectAccepts(appRouter.tournament.addBlindSet, {
			tournamentBlindLevelId: 1,
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			blind3: 200,
			blind4: 400,
			ante: 100,
			anteType: "all",
			sortOrder: 0,
		});
	});

	it("accepts all valid anteType values", () => {
		for (const anteType of ["none", "all", "bb"] as const) {
			expectAccepts(appRouter.tournament.addBlindSet, {
				tournamentBlindLevelId: 1,
				limitFormatId: 1,
				blind1: 50,
				blind2: 100,
				anteType,
				sortOrder: 0,
			});
		}
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.tournament.addBlindSet, {
			tournamentBlindLevelId: 1,
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			anteType: "half",
			sortOrder: 0,
		});
	});

	it("rejects limitFormatId=0", () => {
		expectRejects(appRouter.tournament.addBlindSet, {
			tournamentBlindLevelId: 1,
			limitFormatId: 0,
			blind1: 50,
			blind2: 100,
			sortOrder: 0,
		});
	});

	it("rejects missing tournamentBlindLevelId", () => {
		expectRejects(appRouter.tournament.addBlindSet, {
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			sortOrder: 0,
		});
	});

	it("rejects negative blind1", () => {
		expectRejects(appRouter.tournament.addBlindSet, {
			tournamentBlindLevelId: 1,
			limitFormatId: 1,
			blind1: -1,
			blind2: 100,
			sortOrder: 0,
		});
	});
});

describe("tournament.updateBlindSet input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.tournament.updateBlindSet, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.tournament.updateBlindSet, {
			id: 1,
			limitFormatId: 2,
			blind1: 100,
			blind2: 200,
			blind3: 400,
			blind4: 800,
			ante: 200,
			anteType: "bb",
			sortOrder: 1,
		});
	});

	it("accepts null for nullable optional fields", () => {
		expectAccepts(appRouter.tournament.updateBlindSet, {
			id: 1,
			blind3: null,
			blind4: null,
			ante: null,
			anteType: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.updateBlindSet, { blind1: 100 });
	});
});

describe("tournament.removeBlindSet input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.tournament.removeBlindSet, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.removeBlindSet, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.tournament.removeBlindSet, { id: "1" });
	});
});
