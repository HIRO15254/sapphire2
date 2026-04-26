import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

describe("tournament router", () => {
	it("appRouter has tournament namespace", () => {
		expect(appRouter.tournament).toBeDefined();
	});

	it("has listByStore procedure", () => {
		expect(appRouter.tournament.listByStore).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.tournament.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.tournament.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.tournament.update).toBeDefined();
	});

	it("has archive procedure", () => {
		expect(appRouter.tournament.archive).toBeDefined();
	});

	it("has restore procedure", () => {
		expect(appRouter.tournament.restore).toBeDefined();
	});

	it("has delete procedure", () => {
		expect(appRouter.tournament.delete).toBeDefined();
	});

	it("has addTag procedure", () => {
		expect(appRouter.tournament.addTag).toBeDefined();
	});

	it("has removeTag procedure", () => {
		expect(appRouter.tournament.removeTag).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournament).sort()).toEqual(
			[
				"addTag",
				"archive",
				"create",
				"createWithLevels",
				"delete",
				"getById",
				"listByStore",
				"removeTag",
				"restore",
				"update",
				"updateWithLevels",
			].sort()
		);
	});

	it("listByStore / getById are protected queries", () => {
		expectProtected(appRouter.tournament.listByStore);
		expectType(appRouter.tournament.listByStore, "query");
		expectProtected(appRouter.tournament.getById);
		expectType(appRouter.tournament.getById, "query");
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
			"createWithLevels",
			"updateWithLevels",
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
	it("accepts minimal payload with default variant", () => {
		const schema = getInputSchema(appRouter.tournament.create);
		const parsed = schema.safeParse({
			storeId: "s1",
			name: "Main Event",
		}) as unknown as { success: true; data: { variant: string } };
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBe("nlh");
	});

	it("accepts full numeric configuration", () => {
		expectAccepts(appRouter.tournament.create, {
			storeId: "s1",
			name: "ME",
			buyIn: 100_000,
			entryFee: 10_000,
			startingStack: 30_000,
			bountyAmount: 20_000,
			tableSize: 9,
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
});

describe("tournament.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.tournament.update, { id: "tn1" });
	});

	it("accepts nullable numeric fields set to null", () => {
		expectAccepts(appRouter.tournament.update, {
			id: "tn1",
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
});

describe("tournament.createWithLevels input validation", () => {
	it("accepts minimal payload (no levels)", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			storeId: "s1",
			name: "Series",
		});
	});

	it("accepts a full level + chip purchases structure", () => {
		expectAccepts(appRouter.tournament.createWithLevels, {
			storeId: "s1",
			name: "Series",
			tags: ["weekly"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			blindLevels: [
				{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 },
				{ isBreak: true, minutes: 10 },
			],
		});
	});

	it("rejects a chipPurchase with non-integer cost", () => {
		expectRejects(appRouter.tournament.createWithLevels, {
			storeId: "s1",
			name: "Series",
			chipPurchases: [{ name: "Rebuy", cost: 100.5, chips: 10_000 }],
		});
	});

	it("rejects a blindLevel missing isBreak", () => {
		expectRejects(appRouter.tournament.createWithLevels, {
			storeId: "s1",
			name: "Series",
			blindLevels: [{ blind1: 100 }],
		});
	});
});

describe("tournament.updateWithLevels input validation", () => {
	it("accepts id + required blindLevels array", () => {
		expectAccepts(appRouter.tournament.updateWithLevels, {
			id: "tn1",
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200 }],
		});
	});

	it("rejects missing blindLevels (required field)", () => {
		expectRejects(appRouter.tournament.updateWithLevels, { id: "tn1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournament.updateWithLevels, {
			blindLevels: [],
		});
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
