import { describe, expect, it, vi } from "vitest";

const DISCARDED_REGEX = /discarded/i;

vi.mock("@sapphire2/db", () => ({ db: {} }));

describe("session router structure", () => {
	it("sessionRouter is defined", async () => {
		const { sessionRouter } = await import("../routers/session");
		expect(sessionRouter).toBeDefined();
	});

	it("exposes exactly the expected procedure set", async () => {
		const { sessionRouter } = await import("../routers/session");
		const procedureKeys = Object.keys(sessionRouter).filter(
			(k) => k !== "_def" && k !== "createCaller"
		);
		expect(procedureKeys.sort()).toEqual(
			["create", "delete", "getById", "list", "update"].sort()
		);
	});

	it("list / getById are protected queries", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectProtected, expectType } = await import("./test-utils");
		expectProtected(sessionRouter.list);
		expectType(sessionRouter.list, "query");
		expectProtected(sessionRouter.getById);
		expectType(sessionRouter.getById, "query");
	});

	it("create / update / delete are protected mutations", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectProtected, expectType } = await import("./test-utils");
		for (const proc of [
			sessionRouter.create,
			sessionRouter.update,
			sessionRouter.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

// ---------------------------------------------------------------------------
// session.create input validation
// ---------------------------------------------------------------------------

const CASH_BLIND_SET_BASE = {
	limitFormatId: 1,
	blind1: 1,
	blind2: 2,
	sortOrder: 0,
};

const MANUAL_CASH_BASE = {
	source: "manual",
	kind: "cash_game",
	sessionDate: "2024-01-01T00:00:00Z",
	startedAt: new Date("2024-01-01T10:00:00Z"),
	cashRule: {
		ruleName: "NL Hold'em",
		variantId: 1,
		blindSets: [CASH_BLIND_SET_BASE],
	},
	cashResult: {
		buyIn: 100,
		cashOut: 150,
	},
} as const;

const MANUAL_TOURNAMENT_BASE = {
	source: "manual",
	kind: "tournament",
	sessionDate: "2024-01-01T00:00:00Z",
	startedAt: new Date("2024-01-01T10:00:00Z"),
	tournamentRule: {
		ruleName: "NLHE Tournament",
		buyIn: 100,
		entryFee: 10,
		variantId: 1,
		blindLevels: [],
	},
	tournamentResult: {
		beforeDeadline: false,
		placement: 1,
		totalEntries: 10,
		prizeMoney: 500,
	},
} as const;

describe("session.create input validation — manual cash_game", () => {
	it("accepts minimal valid manual cash_game input", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, MANUAL_CASH_BASE);
	});

	it("accepts full cash_game input with all optional fields", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			endedAt: new Date("2024-01-01T14:00:00Z"),
			breakMinutes: 30,
			memo: "great session",
			storeId: "store-1",
			currencyId: "curr-1",
			tagIds: ["tag-1", "tag-2"],
			ringGameId: "rg-1",
			cashRule: {
				ruleName: "PLO Mix",
				minBuyIn: 50,
				maxBuyIn: 500,
				tableSize: 6,
				variantId: 2,
				blindSets: [
					{ limitFormatId: 1, blind1: 1, blind2: 2, sortOrder: 0 },
					{
						limitFormatId: 2,
						blind1: 1,
						blind2: 2,
						blind3: 4,
						ante: 2,
						anteType: "bb" as const,
						sortOrder: 1,
					},
				],
			},
			cashResult: {
				buyIn: 100,
				cashOut: 200,
				evCashOut: 190,
			},
		});
	});

	it("accepts cash blind sets with all optional fields (blind3/4, ante, anteType)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				...MANUAL_CASH_BASE.cashRule,
				blindSets: [
					{
						limitFormatId: 1,
						blind1: 1,
						blind2: 2,
						blind3: 4,
						blind4: 8,
						ante: 1,
						anteType: "all" as const,
						sortOrder: 0,
					},
				],
			},
		});
	});

	it("rejects when source is 'live' — input schema level", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "live",
			kind: "cash_game",
			sessionDate: "2024-01-01T00:00:00Z",
			startedAt: new Date(),
		});
	});

	it("rejects cash_game missing cashRule", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: undefined,
		});
	});

	it("rejects cash_game missing cashResult", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashResult: undefined,
		});
	});

	it("rejects cash_game with empty blindSets array (min 1)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				...MANUAL_CASH_BASE.cashRule,
				blindSets: [],
			},
		});
	});

	it("rejects cash_game with negative buyIn", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashResult: { buyIn: -1, cashOut: 100 },
		});
	});

	it("rejects cash_game with negative cashOut", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashResult: { buyIn: 100, cashOut: -1 },
		});
	});

	it("accepts buyIn = 0 (boundary)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashResult: { buyIn: 0, cashOut: 0 },
		});
	});

	it("rejects cash_game without startedAt", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		const { startedAt: _omit, ...withoutStartedAt } = MANUAL_CASH_BASE as {
			startedAt: Date;
			source: "manual";
			kind: "cash_game";
			sessionDate: string;
			cashRule: typeof MANUAL_CASH_BASE.cashRule;
			cashResult: typeof MANUAL_CASH_BASE.cashResult;
		};
		expectRejects(sessionRouter.create, withoutStartedAt);
	});

	it("rejects cashRule missing variantId", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				ruleName: "NL",
				blindSets: [CASH_BLIND_SET_BASE],
			},
		});
	});

	it("rejects cashRule with variantId = 0 (below min 1)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				...MANUAL_CASH_BASE.cashRule,
				variantId: 0,
			},
		});
	});

	it("rejects blind set with limitFormatId = 0 (below min 1)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				...MANUAL_CASH_BASE.cashRule,
				blindSets: [{ ...CASH_BLIND_SET_BASE, limitFormatId: 0 }],
			},
		});
	});

	it("rejects anteType with invalid value", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_CASH_BASE,
			cashRule: {
				...MANUAL_CASH_BASE.cashRule,
				blindSets: [
					{
						...CASH_BLIND_SET_BASE,
						anteType: "half",
					},
				],
			},
		});
	});
});

describe("session.create input validation — manual tournament", () => {
	it("accepts minimal valid manual tournament input", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, MANUAL_TOURNAMENT_BASE);
	});

	it("accepts tournament with blindLevels and nested blindSets", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentRule: {
				...MANUAL_TOURNAMENT_BASE.tournamentRule,
				startingStack: 10_000,
				bountyAmount: 50,
				tableSize: 9,
				blindLevels: [
					{
						levelIndex: 0,
						isBreak: false,
						minutes: 20,
						sortOrder: 0,
						blindSets: [
							{ limitFormatId: 1, blind1: 25, blind2: 50, sortOrder: 0 },
						],
					},
					{
						levelIndex: 1,
						isBreak: true,
						minutes: 10,
						sortOrder: 1,
						blindSets: [],
					},
				],
			},
		});
	});

	it("accepts tournament with chipPurchaseOptions and chipPurchaseRecords", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			chipPurchaseOptions: [
				{ name: "Rebuy", cost: 100, chips: 10_000, sortOrder: 0 },
				{ name: "Add-on", cost: 200, chips: 20_000, sortOrder: 1 },
			],
			chipPurchaseRecords: [
				{ optionSortOrder: 0, count: 2 },
				{ optionSortOrder: 1, count: 1 },
			],
		});
	});

	it("accepts tournament with beforeDeadline=true (placement/totalEntries not required)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentResult: {
				beforeDeadline: true,
				prizeMoney: 0,
			},
		});
	});

	it("accepts tournament with timerStartedAt in result", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentResult: {
				...MANUAL_TOURNAMENT_BASE.tournamentResult,
				timerStartedAt: new Date("2024-01-01T10:05:00Z"),
			},
		});
	});

	it("entryFee defaults to 0 when omitted", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { getInputSchema } = await import("./test-utils");
		const schema = getInputSchema(sessionRouter.create);
		const result = schema.safeParse({
			...MANUAL_TOURNAMENT_BASE,
			tournamentRule: {
				ruleName: "NLHE",
				buyIn: 100,
				variantId: 1,
				blindLevels: [],
			},
		});
		expect(result.success).toBe(true);
	});

	it("accepts optional tournamentId (informational FK)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentId: "tourn-1",
		});
	});

	it("rejects tournament missing tournamentRule", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "manual",
			kind: "tournament",
			sessionDate: "2024-01-01",
			startedAt: new Date(),
			tournamentResult: { beforeDeadline: false },
		});
	});

	it("rejects tournament missing tournamentResult", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "manual",
			kind: "tournament",
			sessionDate: "2024-01-01",
			startedAt: new Date(),
			tournamentRule: {
				ruleName: "NLHE",
				buyIn: 100,
				variantId: 1,
				blindLevels: [],
			},
		});
	});

	it("rejects tournament buyIn below 0", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentRule: {
				...MANUAL_TOURNAMENT_BASE.tournamentRule,
				buyIn: -1,
			},
		});
	});

	it("rejects tournament placement below 1", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentResult: {
				beforeDeadline: false,
				placement: 0,
			},
		});
	});

	it("rejects chipPurchaseOption with empty name", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			chipPurchaseOptions: [{ name: "", cost: 100, chips: 1000, sortOrder: 0 }],
		});
	});

	it("rejects chipPurchaseRecord with negative count", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			chipPurchaseOptions: [
				{ name: "Rebuy", cost: 100, chips: 10_000, sortOrder: 0 },
			],
			chipPurchaseRecords: [{ optionSortOrder: 0, count: -1 }],
		});
	});

	it("accepts count = 0 in chipPurchaseRecords (boundary)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			chipPurchaseOptions: [
				{ name: "Rebuy", cost: 100, chips: 10_000, sortOrder: 0 },
			],
			chipPurchaseRecords: [{ optionSortOrder: 0, count: 0 }],
		});
	});

	it("accepts MIX tournament with multiple blindSets per level", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.create, {
			...MANUAL_TOURNAMENT_BASE,
			tournamentRule: {
				...MANUAL_TOURNAMENT_BASE.tournamentRule,
				blindLevels: [
					{
						levelIndex: 0,
						isBreak: false,
						minutes: 30,
						sortOrder: 0,
						blindSets: [
							{ limitFormatId: 1, blind1: 25, blind2: 50, sortOrder: 0 },
							{ limitFormatId: 3, blind1: 50, blind2: 100, sortOrder: 1 },
						],
					},
				],
			},
		});
	});
});

// ---------------------------------------------------------------------------
// session.list input validation
// ---------------------------------------------------------------------------

describe("session.list input validation", () => {
	it("accepts empty object (all filters optional)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.list, {});
	});

	it("accepts all filter combinations", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.list, {
			cursor: "s1",
			type: "cash_game",
			storeId: "st1",
			currencyId: "c1",
			dateFrom: 1_700_000_000,
			dateTo: 1_800_000_000,
		});
	});

	it("accepts tournament type filter", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.list, { type: "tournament" });
	});

	it("rejects unknown type", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.list, { type: "hybrid" });
	});

	it("rejects non-number dateFrom", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.list, { dateFrom: "2024-01-01" });
	});

	it("accepts empty object (undefined input also ok since all optional)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.list, {});
	});
});

// ---------------------------------------------------------------------------
// session.getById input validation
// ---------------------------------------------------------------------------

describe("session.getById input validation", () => {
	it("accepts { id }", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.getById, { id: "s1" });
	});

	it("rejects missing id", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.getById, {});
	});

	it("rejects non-string id", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.getById, { id: 1 });
	});
});

// ---------------------------------------------------------------------------
// session.update input validation
// ---------------------------------------------------------------------------

describe("session.update input validation", () => {
	it("accepts id-only payload (no-op)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, { id: "s1" });
	});

	it("accepts common field updates", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			sessionDate: "2024-06-01T00:00:00Z",
			startedAt: new Date("2024-06-01T10:00:00Z"),
			endedAt: new Date("2024-06-01T14:00:00Z"),
			breakMinutes: 15,
			memo: "updated memo",
			storeId: "store-1",
			currencyId: "curr-1",
			tagIds: ["tag-1"],
		});
	});

	it("accepts null for nullable fields", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			startedAt: null,
			endedAt: null,
			breakMinutes: null,
			memo: null,
			storeId: null,
			currencyId: null,
		});
	});

	it("accepts cash rule snapshot field updates", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			cashRuleName: "New Rule",
			minBuyIn: 50,
			maxBuyIn: 500,
			tableSize: 6,
			variantId: 2,
			ringGameId: "rg-1",
		});
	});

	it("accepts cash result field updates", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			buyIn: 100,
			cashOut: 200,
			evCashOut: 195,
		});
	});

	it("accepts tournament rule snapshot field updates", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			tournamentRuleName: "NLHE",
			startingStack: 10_000,
			bountyAmount: 50,
			tableSize: 9,
			tournamentBuyIn: 200,
			entryFee: 20,
			tournamentId: "tourn-1",
		});
	});

	it("accepts tournament result field updates", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			placement: 3,
			totalEntries: 100,
			beforeDeadline: false,
			prizeMoney: 5000,
			bountyPrizes: 500,
		});
	});

	it("rejects missing id", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { buyIn: 100 });
	});

	it("rejects buyIn < 0", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { id: "s1", buyIn: -1 });
	});

	it("rejects placement < 1", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { id: "s1", placement: 0 });
	});

	it("rejects breakMinutes < 0", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { id: "s1", breakMinutes: -1 });
	});

	it("accepts breakMinutes = 0 (boundary)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, { id: "s1", breakMinutes: 0 });
	});

	it("accepts null ringGameId and tournamentId to clear FK", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, {
			id: "s1",
			ringGameId: null,
			tournamentId: null,
		});
	});

	it("rejects variantId = 0 (below min 1)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { id: "s1", variantId: 0 });
	});

	it("rejects tableSize = 0 (below min 1)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.update, { id: "s1", tableSize: 0 });
	});

	it("accepts tableSize = 1 (boundary min)", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.update, { id: "s1", tableSize: 1 });
	});
});

// ---------------------------------------------------------------------------
// session.delete input validation
// ---------------------------------------------------------------------------

describe("session.delete input validation", () => {
	it("accepts { id }", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectAccepts } = await import("./test-utils");
		expectAccepts(sessionRouter.delete, { id: "s1" });
	});

	it("rejects missing id", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.delete, {});
	});
});

// ---------------------------------------------------------------------------
// assertNotDiscarded helper
// ---------------------------------------------------------------------------

describe("assertNotDiscarded", () => {
	it("does not throw for 'active' status", async () => {
		const { assertNotDiscarded } = await import("../routers/session");
		expect(() => assertNotDiscarded("active")).not.toThrow();
	});

	it("does not throw for 'completed' status", async () => {
		const { assertNotDiscarded } = await import("../routers/session");
		expect(() => assertNotDiscarded("completed")).not.toThrow();
	});

	it("does not throw for 'paused' status", async () => {
		const { assertNotDiscarded } = await import("../routers/session");
		expect(() => assertNotDiscarded("paused")).not.toThrow();
	});

	it("throws TRPCError with BAD_REQUEST for 'discarded'", async () => {
		const { assertNotDiscarded } = await import("../routers/session");
		const { TRPCError } = await import("@trpc/server");
		expect(() => assertNotDiscarded("discarded")).toThrow(TRPCError);
		try {
			assertNotDiscarded("discarded");
		} catch (err) {
			expect((err as InstanceType<typeof TRPCError>).code).toBe("BAD_REQUEST");
		}
	});

	it("throws with message mentioning 'discarded'", async () => {
		const { assertNotDiscarded } = await import("../routers/session");
		expect(() => assertNotDiscarded("discarded")).toThrow(DISCARDED_REGEX);
	});
});

// ---------------------------------------------------------------------------
// Discriminated union — source='live' is rejected at schema level
// ---------------------------------------------------------------------------

describe("session.create discriminated union rejects source='live'", () => {
	it("does not accept source='live' with kind='cash_game'", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "live",
			kind: "cash_game",
			sessionDate: "2024-01-01",
			startedAt: new Date(),
			cashRule: {
				ruleName: "NL",
				variantId: 1,
				blindSets: [{ limitFormatId: 1, blind1: 1, blind2: 2, sortOrder: 0 }],
			},
			cashResult: { buyIn: 100, cashOut: 100 },
		});
	});

	it("does not accept source='live' with kind='tournament'", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "live",
			kind: "tournament",
			sessionDate: "2024-01-01",
			startedAt: new Date(),
		});
	});

	it("does not accept unknown kind", async () => {
		const { sessionRouter } = await import("../routers/session");
		const { expectRejects } = await import("./test-utils");
		expectRejects(sessionRouter.create, {
			source: "manual",
			kind: "unknown",
			sessionDate: "2024-01-01",
			startedAt: new Date(),
		});
	});
});
