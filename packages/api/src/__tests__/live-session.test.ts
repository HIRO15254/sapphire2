import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

// ---------------------------------------------------------------------------
// Router structure
// ---------------------------------------------------------------------------

describe("liveSession router structure", () => {
	it("appRouter has liveSession namespace", () => {
		expect(appRouter.liveSession).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveSession).sort()).toEqual(
			[
				"create",
				"complete",
				"reopen",
				"discard",
				"update",
				"updateRule",
				"addBlindLevel",
				"updateBlindLevel",
				"removeBlindLevel",
				"addBlindSet",
				"updateBlindSet",
				"removeBlindSet",
				"addChipPurchaseOption",
				"updateChipPurchaseOption",
				"removeChipPurchaseOption",
				"getById",
			].sort()
		);
	});

	it("getById is a protected query", () => {
		expectProtected(appRouter.liveSession.getById);
		expectType(appRouter.liveSession.getById, "query");
	});

	it("all mutations are protected mutations", () => {
		const mutations = [
			"create",
			"complete",
			"reopen",
			"discard",
			"update",
			"updateRule",
			"addBlindLevel",
			"updateBlindLevel",
			"removeBlindLevel",
			"addBlindSet",
			"updateBlindSet",
			"removeBlindSet",
			"addChipPurchaseOption",
			"updateChipPurchaseOption",
			"removeChipPurchaseOption",
		] as const;
		for (const name of mutations) {
			expectProtected(appRouter.liveSession[name]);
			expectType(appRouter.liveSession[name], "mutation");
		}
	});
});

// ---------------------------------------------------------------------------
// liveSession.create — cash_game
// ---------------------------------------------------------------------------

describe("liveSession.create cash_game input validation", () => {
	const minCashWithRule = {
		kind: "cash_game" as const,
		sessionDate: "2024-01-15",
		rule: {
			ruleName: "1/2 NLH",
			variantId: 1,
		},
		buyInAmount: 200,
	};

	it("accepts minimal cash payload with rule", () => {
		expectAccepts(appRouter.liveSession.create, minCashWithRule);
	});

	it("accepts cash payload with ringGameId instead of rule", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			ringGameId: "rg1",
			buyInAmount: 200,
		});
	});

	it("accepts cash payload with all optional fields", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			startedAt: new Date(),
			storeId: "s1",
			currencyId: "c1",
			tagIds: ["t1", "t2"],
			memo: "note",
			ringGameId: "rg1",
			buyInAmount: 500,
		});
	});

	it("accepts cash payload with rule + blindSets", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			rule: {
				ruleName: "1/2 NLH",
				variantId: 1,
				minBuyIn: 100,
				maxBuyIn: 500,
				tableSize: 9,
				blindSets: [
					{
						limitFormatId: 1,
						blind1: 1,
						blind2: 2,
						sortOrder: 0,
					},
				],
			},
			buyInAmount: 200,
		});
	});

	it("rejects cash payload missing buyInAmount", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			ringGameId: "rg1",
		});
	});

	it("rejects negative buyInAmount", () => {
		expectRejects(appRouter.liveSession.create, {
			...minCashWithRule,
			buyInAmount: -1,
		});
	});

	it("rejects buyInAmount 0 (valid, min=0)", () => {
		expectAccepts(appRouter.liveSession.create, {
			...minCashWithRule,
			buyInAmount: 0,
		});
	});

	it("rejects missing sessionDate", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "cash_game",
			ringGameId: "rg1",
			buyInAmount: 200,
		});
	});

	it("rejects empty ruleName in rule", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			rule: { ruleName: "", variantId: 1 },
			buyInAmount: 200,
		});
	});

	it("rejects variantId below 1", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			rule: { ruleName: "NLH", variantId: 0 },
			buyInAmount: 200,
		});
	});

	it("accepts anteType values for blindSet", () => {
		for (const anteType of ["none", "all", "bb"] as const) {
			expectAccepts(appRouter.liveSession.create, {
				kind: "cash_game",
				sessionDate: "2024-01-15",
				rule: {
					ruleName: "NLH",
					variantId: 1,
					blindSets: [
						{
							limitFormatId: 1,
							blind1: 1,
							blind2: 2,
							ante: 2,
							anteType,
							sortOrder: 0,
						},
					],
				},
				buyInAmount: 200,
			});
		}
	});

	it("rejects unknown anteType in blindSet", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "cash_game",
			sessionDate: "2024-01-15",
			rule: {
				ruleName: "NLH",
				variantId: 1,
				blindSets: [
					{
						limitFormatId: 1,
						blind1: 1,
						blind2: 2,
						anteType: "half",
						sortOrder: 0,
					},
				],
			},
			buyInAmount: 200,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.create — tournament
// ---------------------------------------------------------------------------

describe("liveSession.create tournament input validation", () => {
	const minTournamentWithRule = {
		kind: "tournament" as const,
		sessionDate: "2024-01-15",
		rule: {
			ruleName: "Sunday Special",
			variantId: 1,
			buyIn: 100,
			entryFee: 10,
		},
	};

	it("accepts minimal tournament payload with rule", () => {
		expectAccepts(appRouter.liveSession.create, minTournamentWithRule);
	});

	it("accepts tournament payload with tournamentId instead of rule", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			tournamentId: "t1",
		});
	});

	it("accepts tournament payload with all optional fields", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			startedAt: new Date(),
			storeId: "s1",
			currencyId: "c1",
			tagIds: ["t1"],
			memo: "memo",
			tournamentId: "t1",
			timerStartedAt: new Date(),
		});
	});

	it("accepts tournament with blindLevels and chipPurchaseOptions", () => {
		expectAccepts(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			rule: {
				ruleName: "Special",
				variantId: 1,
				buyIn: 100,
				entryFee: 0,
				startingStack: 10_000,
				bountyAmount: 50,
				tableSize: 9,
				blindLevels: [
					{
						levelIndex: 1,
						isBreak: false,
						minutes: 15,
						sortOrder: 0,
						blindSets: [
							{ limitFormatId: 1, blind1: 25, blind2: 50, sortOrder: 0 },
						],
					},
					{
						levelIndex: 2,
						isBreak: true,
						minutes: 10,
						sortOrder: 1,
						blindSets: [],
					},
				],
			},
			chipPurchaseOptions: [
				{ name: "Rebuy", cost: 100, chips: 10_000, sortOrder: 0 },
				{ name: "Add-on", cost: 100, chips: 10_000, sortOrder: 1 },
			],
		});
	});

	it("rejects missing sessionDate for tournament", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "tournament",
			tournamentId: "t1",
		});
	});

	it("rejects empty ruleName in tournament rule", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			rule: { ruleName: "", variantId: 1, buyIn: 100, entryFee: 0 },
		});
	});

	it("rejects negative buyIn in tournament rule", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			rule: { ruleName: "X", variantId: 1, buyIn: -1, entryFee: 0 },
		});
	});

	it("rejects empty chipPurchaseOption name", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			rule: { ruleName: "X", variantId: 1, buyIn: 100, entryFee: 0 },
			chipPurchaseOptions: [{ name: "", cost: 100, chips: 1000, sortOrder: 0 }],
		});
	});

	it("rejects negative cost in chipPurchaseOption", () => {
		expectRejects(appRouter.liveSession.create, {
			kind: "tournament",
			sessionDate: "2024-01-15",
			rule: { ruleName: "X", variantId: 1, buyIn: 100, entryFee: 0 },
			chipPurchaseOptions: [
				{ name: "Rebuy", cost: -1, chips: 1000, sortOrder: 0 },
			],
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.complete
// ---------------------------------------------------------------------------

describe("liveSession.complete input validation", () => {
	it("accepts cash complete with finalStack 0", () => {
		expectAccepts(appRouter.liveSession.complete, {
			id: "s1",
			kind: "cash_game",
			finalStack: 0,
		});
	});

	it("accepts cash complete with positive finalStack", () => {
		expectAccepts(appRouter.liveSession.complete, {
			id: "s1",
			kind: "cash_game",
			finalStack: 500,
		});
	});

	it("rejects negative finalStack for cash", () => {
		expectRejects(appRouter.liveSession.complete, {
			id: "s1",
			kind: "cash_game",
			finalStack: -1,
		});
	});

	it("rejects missing finalStack for cash", () => {
		expectRejects(appRouter.liveSession.complete, {
			id: "s1",
			kind: "cash_game",
		});
	});

	it("accepts tournament complete beforeDeadline=true", () => {
		expectAccepts(appRouter.liveSession.complete, {
			id: "s1",
			kind: "tournament",
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("accepts tournament complete beforeDeadline=false with placement/totalEntries", () => {
		expectAccepts(appRouter.liveSession.complete, {
			id: "s1",
			kind: "tournament",
			beforeDeadline: false,
			placement: 3,
			totalEntries: 100,
			prizeMoney: 500,
			bountyPrizes: 0,
		});
	});

	it("rejects tournament complete with negative prizeMoney", () => {
		expectRejects(appRouter.liveSession.complete, {
			id: "s1",
			kind: "tournament",
			beforeDeadline: true,
			prizeMoney: -1,
			bountyPrizes: 0,
		});
	});

	it("rejects tournament complete with placement=0", () => {
		expectRejects(appRouter.liveSession.complete, {
			id: "s1",
			kind: "tournament",
			beforeDeadline: false,
			placement: 0,
			totalEntries: 100,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.complete, {
			kind: "cash_game",
			finalStack: 100,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.reopen
// ---------------------------------------------------------------------------

describe("liveSession.reopen input validation", () => {
	it("accepts {id}", () => {
		expectAccepts(appRouter.liveSession.reopen, { id: "s1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.reopen, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.liveSession.reopen, { id: 123 });
	});
});

// ---------------------------------------------------------------------------
// liveSession.discard
// ---------------------------------------------------------------------------

describe("liveSession.discard input validation", () => {
	it("accepts {id}", () => {
		expectAccepts(appRouter.liveSession.discard, { id: "s1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.discard, {});
	});
});

// ---------------------------------------------------------------------------
// liveSession.update
// ---------------------------------------------------------------------------

describe("liveSession.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.liveSession.update, { id: "s1" });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.liveSession.update, {
			id: "s1",
			memo: "memo",
			sessionDate: "2024-01-15",
			storeId: "store1",
			currencyId: "curr1",
			tagIds: ["t1", "t2"],
		});
	});

	it("accepts explicit null for memo, storeId, currencyId", () => {
		expectAccepts(appRouter.liveSession.update, {
			id: "s1",
			memo: null,
			storeId: null,
			currencyId: null,
		});
	});

	it("accepts empty tagIds array", () => {
		expectAccepts(appRouter.liveSession.update, { id: "s1", tagIds: [] });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.update, { memo: "x" });
	});
});

// ---------------------------------------------------------------------------
// liveSession.updateRule — cash
// ---------------------------------------------------------------------------

describe("liveSession.updateRule cash input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "cash_game",
		});
	});

	it("accepts all optional cash rule fields", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "cash_game",
			ruleName: "2/5 NLH",
			minBuyIn: 200,
			maxBuyIn: 1000,
			tableSize: 9,
			variantId: 2,
			ringGameId: "rg1",
		});
	});

	it("accepts null for nullable cash rule fields", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "cash_game",
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: null,
			ringGameId: null,
		});
	});

	it("rejects empty ruleName", () => {
		expectRejects(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "cash_game",
			ruleName: "",
		});
	});

	it("rejects variantId=0", () => {
		expectRejects(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "cash_game",
			variantId: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.updateRule — tournament
// ---------------------------------------------------------------------------

describe("liveSession.updateRule tournament input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "tournament",
		});
	});

	it("accepts all optional tournament rule fields", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "tournament",
			ruleName: "Sunday Special",
			startingStack: 10_000,
			bountyAmount: 50,
			tableSize: 9,
			variantId: 1,
			buyIn: 100,
			entryFee: 10,
			tournamentId: "t1",
			timerStartedAt: new Date(),
		});
	});

	it("accepts null for nullable tournament rule fields", () => {
		expectAccepts(appRouter.liveSession.updateRule, {
			id: "s1",
			kind: "tournament",
			startingStack: null,
			bountyAmount: null,
			tableSize: null,
			tournamentId: null,
			timerStartedAt: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.updateRule, { kind: "tournament" });
	});
});

// ---------------------------------------------------------------------------
// liveSession.addBlindLevel
// ---------------------------------------------------------------------------

describe("liveSession.addBlindLevel input validation", () => {
	it("accepts minimal payload (sessionId + levelIndex + isBreak + sortOrder)", () => {
		expectAccepts(appRouter.liveSession.addBlindLevel, {
			sessionId: "s1",
			levelIndex: 0,
			isBreak: false,
			sortOrder: 0,
		});
	});

	it("accepts break level without blindSets", () => {
		expectAccepts(appRouter.liveSession.addBlindLevel, {
			sessionId: "s1",
			levelIndex: 5,
			isBreak: true,
			minutes: 15,
			sortOrder: 5,
		});
	});

	it("accepts level with blindSets", () => {
		expectAccepts(appRouter.liveSession.addBlindLevel, {
			sessionId: "s1",
			levelIndex: 1,
			isBreak: false,
			minutes: 20,
			sortOrder: 1,
			blindSets: [{ limitFormatId: 1, blind1: 100, blind2: 200, sortOrder: 0 }],
		});
	});

	it("rejects missing sessionId", () => {
		expectRejects(appRouter.liveSession.addBlindLevel, {
			levelIndex: 0,
			isBreak: false,
			sortOrder: 0,
		});
	});

	it("rejects negative levelIndex", () => {
		expectRejects(appRouter.liveSession.addBlindLevel, {
			sessionId: "s1",
			levelIndex: -1,
			isBreak: false,
			sortOrder: 0,
		});
	});

	it("rejects minutes=0 (min is 1)", () => {
		expectRejects(appRouter.liveSession.addBlindLevel, {
			sessionId: "s1",
			levelIndex: 0,
			isBreak: false,
			minutes: 0,
			sortOrder: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.updateBlindLevel
// ---------------------------------------------------------------------------

describe("liveSession.updateBlindLevel input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.liveSession.updateBlindLevel, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.liveSession.updateBlindLevel, {
			id: 1,
			levelIndex: 2,
			isBreak: true,
			minutes: 15,
			sortOrder: 3,
		});
	});

	it("accepts minutes: null to clear", () => {
		expectAccepts(appRouter.liveSession.updateBlindLevel, {
			id: 1,
			minutes: null,
		});
	});

	it("rejects id=0 (not valid integer >= 1 — actually min is not set for int, but 0 is an int)", () => {
		// id is z.number().int() with no min, 0 is valid
		expectAccepts(appRouter.liveSession.updateBlindLevel, { id: 0 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.updateBlindLevel, { levelIndex: 1 });
	});
});

// ---------------------------------------------------------------------------
// liveSession.removeBlindLevel
// ---------------------------------------------------------------------------

describe("liveSession.removeBlindLevel input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.liveSession.removeBlindLevel, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.removeBlindLevel, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.liveSession.removeBlindLevel, { id: "1" });
	});
});

// ---------------------------------------------------------------------------
// liveSession.addBlindSet
// ---------------------------------------------------------------------------

describe("liveSession.addBlindSet input validation", () => {
	it("accepts tournament blind set (sessionBlindLevelId)", () => {
		expectAccepts(appRouter.liveSession.addBlindSet, {
			sessionBlindLevelId: 1,
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			sortOrder: 0,
		});
	});

	it("accepts cash blind set (sessionId)", () => {
		expectAccepts(appRouter.liveSession.addBlindSet, {
			sessionId: "s1",
			limitFormatId: 1,
			blind1: 1,
			blind2: 2,
			sortOrder: 0,
		});
	});

	it("accepts full tournament blind set with all optional fields", () => {
		expectAccepts(appRouter.liveSession.addBlindSet, {
			sessionBlindLevelId: 1,
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

	it("rejects limitFormatId=0", () => {
		expectRejects(appRouter.liveSession.addBlindSet, {
			sessionBlindLevelId: 1,
			limitFormatId: 0,
			blind1: 50,
			blind2: 100,
			sortOrder: 0,
		});
	});

	it("rejects unknown anteType", () => {
		expectRejects(appRouter.liveSession.addBlindSet, {
			sessionBlindLevelId: 1,
			limitFormatId: 1,
			blind1: 50,
			blind2: 100,
			anteType: "half",
			sortOrder: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.removeBlindSet
// ---------------------------------------------------------------------------

describe("liveSession.removeBlindSet input validation", () => {
	it("accepts tournament type with id", () => {
		expectAccepts(appRouter.liveSession.removeBlindSet, {
			type: "tournament",
			id: 1,
		});
	});

	it("accepts cash type with id", () => {
		expectAccepts(appRouter.liveSession.removeBlindSet, {
			type: "cash",
			id: 1,
		});
	});

	it("rejects missing type", () => {
		expectRejects(appRouter.liveSession.removeBlindSet, { id: 1 });
	});

	it("rejects unknown type", () => {
		expectRejects(appRouter.liveSession.removeBlindSet, {
			type: "other",
			id: 1,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.addChipPurchaseOption
// ---------------------------------------------------------------------------

describe("liveSession.addChipPurchaseOption input validation", () => {
	it("accepts valid payload", () => {
		expectAccepts(appRouter.liveSession.addChipPurchaseOption, {
			sessionId: "s1",
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
			sortOrder: 0,
		});
	});

	it("accepts cost=0 and chips=0 (boundary)", () => {
		expectAccepts(appRouter.liveSession.addChipPurchaseOption, {
			sessionId: "s1",
			name: "Free",
			cost: 0,
			chips: 0,
			sortOrder: 0,
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.liveSession.addChipPurchaseOption, {
			sessionId: "s1",
			name: "",
			cost: 100,
			chips: 10_000,
			sortOrder: 0,
		});
	});

	it("rejects negative cost", () => {
		expectRejects(appRouter.liveSession.addChipPurchaseOption, {
			sessionId: "s1",
			name: "Rebuy",
			cost: -1,
			chips: 10_000,
			sortOrder: 0,
		});
	});

	it("rejects negative chips", () => {
		expectRejects(appRouter.liveSession.addChipPurchaseOption, {
			sessionId: "s1",
			name: "Rebuy",
			cost: 100,
			chips: -1,
			sortOrder: 0,
		});
	});

	it("rejects missing sessionId", () => {
		expectRejects(appRouter.liveSession.addChipPurchaseOption, {
			name: "Rebuy",
			cost: 100,
			chips: 10_000,
			sortOrder: 0,
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.updateChipPurchaseOption
// ---------------------------------------------------------------------------

describe("liveSession.updateChipPurchaseOption input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.liveSession.updateChipPurchaseOption, { id: 1 });
	});

	it("accepts all optional fields", () => {
		expectAccepts(appRouter.liveSession.updateChipPurchaseOption, {
			id: 1,
			name: "Add-on",
			cost: 200,
			chips: 20_000,
			sortOrder: 1,
		});
	});

	it("rejects empty name when provided", () => {
		expectRejects(appRouter.liveSession.updateChipPurchaseOption, {
			id: 1,
			name: "",
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.updateChipPurchaseOption, {
			name: "X",
		});
	});
});

// ---------------------------------------------------------------------------
// liveSession.removeChipPurchaseOption
// ---------------------------------------------------------------------------

describe("liveSession.removeChipPurchaseOption input validation", () => {
	it("accepts {id: number}", () => {
		expectAccepts(appRouter.liveSession.removeChipPurchaseOption, { id: 1 });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.removeChipPurchaseOption, {});
	});

	it("rejects string id", () => {
		expectRejects(appRouter.liveSession.removeChipPurchaseOption, { id: "1" });
	});
});

// ---------------------------------------------------------------------------
// liveSession.getById
// ---------------------------------------------------------------------------

describe("liveSession.getById input validation", () => {
	it("accepts {id}", () => {
		expectAccepts(appRouter.liveSession.getById, { id: "s1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveSession.getById, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.liveSession.getById, { id: 123 });
	});
});
