import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

describe("tournamentChipPurchase router structure", () => {
	it("appRouter has tournamentChipPurchase namespace", () => {
		expect(appRouter.tournamentChipPurchase).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.tournamentChipPurchase).sort()).toEqual(
			["create", "delete", "listByTournament", "reorder", "update"].sort()
		);
	});

	it("listByTournament is a protected query", () => {
		expectProtected(appRouter.tournamentChipPurchase.listByTournament);
		expectType(appRouter.tournamentChipPurchase.listByTournament, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of ["create", "update", "delete", "reorder"] as const) {
			const proc = appRouter.tournamentChipPurchase[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("tournamentChipPurchase.listByTournament input validation", () => {
	it("accepts valid tournamentId", () => {
		expectAccepts(appRouter.tournamentChipPurchase.listByTournament, {
			tournamentId: "tn1",
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.listByTournament, {});
	});
});

describe("tournamentChipPurchase.create input validation", () => {
	const valid = {
		tournamentId: "tn1",
		name: "Rebuy",
		cost: 100,
		chips: 10_000,
	};

	it("accepts a valid creation payload", () => {
		expectAccepts(appRouter.tournamentChipPurchase.create, valid);
	});

	it("accepts cost=0 and chips=0 (free add-on edge case)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: 0,
			chips: 0,
		});
	});

	it("accepts negative cost (correction) — schema is permissive", () => {
		// The schema uses z.number().int() without a min; runtime-level business
		// validation would live elsewhere. We pin this to prevent silent
		// tightening.
		expectAccepts(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: -50,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			name: "",
		});
	});

	it("rejects non-integer cost", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			cost: 12.5,
		});
	});

	it("rejects non-integer chips", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			...valid,
			chips: 100.5,
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.create, {
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
		});
	});
});

describe("tournamentChipPurchase.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.update, { id: "cp1" });
	});

	it("accepts all optional fields together", () => {
		expectAccepts(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			name: "Rebuy-2",
			cost: 150,
			chips: 12_000,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			name: "",
		});
	});

	it("rejects non-integer chips", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, {
			id: "cp1",
			chips: 1.5,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournamentChipPurchase.update, { chips: 100 });
	});
});

describe("tournamentChipPurchase.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.tournamentChipPurchase.delete, { id: "cp1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.tournamentChipPurchase.delete, {});
	});
});

describe("tournamentChipPurchase.reorder input validation", () => {
	it("accepts a tournamentId and array of ids (including empty)", () => {
		expectAccepts(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: [],
		});
		expectAccepts(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: ["cp1", "cp2", "cp3"],
		});
	});

	it("rejects missing tournamentId", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			ids: ["cp1"],
		});
	});

	it("rejects non-array ids", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: "cp1",
		});
	});

	it("rejects non-string id entries", () => {
		expectRejects(appRouter.tournamentChipPurchase.reorder, {
			tournamentId: "tn1",
			ids: ["cp1", 42],
		});
	});
});
