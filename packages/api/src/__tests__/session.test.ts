import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	assertNoLiveLinkedRestrictedEdits,
	computeTournamentPL,
	encodeSessionCursor,
	parseSessionCursor,
} from "../routers/session";

const DERIVED_FIELDS_RE = /Cannot edit fields derived from live session events/;
const RING_CONFIG_RE = /variant|blind1|blind2/;
const SESSION_DATE_RE = /sessionDate/;
const PLACEMENT_RE = /placement/;
const PRIZE_MONEY_RE = /prizeMoney/;
const TOURNAMENT_ID_RE = /tournamentId/;

describe("session router", () => {
	it("appRouter has session namespace", () => {
		expect(appRouter.session).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.session).sort()).toEqual(
			[
				"create",
				"delete",
				"getById",
				"list",
				"profitLossSeries",
				"update",
			].sort()
		);
	});
});

describe("session.profitLossSeries input validation", () => {
	function getSchema() {
		return (
			appRouter.session.profitLossSeries as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
	}

	it("accepts an empty object (all filters optional)", () => {
		expect(getSchema().safeParse({}).success).toBe(true);
	});

	it("accepts the full filter combination", () => {
		expect(
			getSchema().safeParse({
				type: "cash_game",
				roomId: "s1",
				ringGameId: "rg1",
				currencyId: "c1",
				dateFrom: 1_700_000_000,
				dateTo: 1_800_000_000,
			}).success
		).toBe(true);
	});

	it("rejects an unknown type value", () => {
		expect(getSchema().safeParse({ type: "spin_and_go" }).success).toBe(false);
	});

	it("rejects non-numeric dateFrom", () => {
		expect(getSchema().safeParse({ dateFrom: "today" }).success).toBe(false);
	});
});

describe("session router input validation", () => {
	const CASH_BASE = {
		type: "cash_game",
		sessionDate: 1_700_000_000,
		buyIn: 1000,
		cashOut: 2000,
	} as const;

	const TOURNAMENT_BASE = {
		type: "tournament",
		sessionDate: 1_700_000_000,
		tournamentBuyIn: 10_000,
	} as const;

	it("create accepts a valid cash_game session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse(CASH_BASE).success).toBe(true);
	});

	it("create accepts a valid tournament session (entryFee defaults to 0)", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: true;
				data: { entryFee: number };
			};
		};
		const parsed = schema.safeParse(TOURNAMENT_BASE) as unknown as {
			success: true;
			data: { entryFee: number };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.entryFee).toBe(0);
	});

	it("create rejects tournament session where placement > totalEntries", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				placement: 10,
				totalEntries: 5,
			}).success
		).toBe(false);
	});

	it("create accepts tournament session where placement == totalEntries (boundary)", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				placement: 5,
				totalEntries: 5,
			}).success
		).toBe(true);
	});

	it("create accepts a promoted tournament Day1 with bagStack and previousSessionId", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: boolean;
				data?: {
					result?: string;
					bagStack?: number;
					previousSessionId?: string;
				};
			};
		};
		const parsed = schema.safeParse({
			...TOURNAMENT_BASE,
			result: "promoted",
			bagStack: 120_000,
			previousSessionId: "day0-session",
		});
		expect(parsed.success).toBe(true);
		expect(parsed.data?.result).toBe("promoted");
		expect(parsed.data?.bagStack).toBe(120_000);
		expect(parsed.data?.previousSessionId).toBe("day0-session");
	});

	it("create rejects a negative bagStack", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({ ...TOURNAMENT_BASE, result: "promoted", bagStack: -1 })
				.success
		).toBe(false);
	});

	it("create rejects an unknown result literal", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({ ...TOURNAMENT_BASE, result: "busted" }).success
		).toBe(false);
	});

	it("create rejects unknown discriminator type", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				type: "other",
				sessionDate: 1,
				buyIn: 0,
				cashOut: 0,
			}).success
		).toBe(false);
	});

	it("create rejects negative buyIn", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ ...CASH_BASE, buyIn: -1 }).success).toBe(false);
	});

	it("list accepts empty object (all filters optional)", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("list accepts all filter combinations", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				cursor: "s1",
				type: "cash_game",
				roomId: "st1",
				currencyId: "c1",
				dateFrom: 1,
				dateTo: 2,
			}).success
		).toBe(true);
	});

	it("list rejects unknown type", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ type: "hybrid" }).success).toBe(false);
	});

	describe("session list cursor (composite keyset)", () => {
		it("encodes a row as <epochMs>_<id>", () => {
			expect(
				encodeSessionCursor({ id: "s1", sessionDate: new Date(1000) })
			).toBe("1000_s1");
		});

		it("round-trips an encoded cursor back to its date and id", () => {
			const cursor = encodeSessionCursor({
				id: "abc",
				sessionDate: new Date(1_700_000_000_000),
			});
			const parsed = parseSessionCursor(cursor);
			expect(parsed?.id).toBe("abc");
			expect(parsed?.sessionDate.getTime()).toBe(1_700_000_000_000);
		});

		it("preserves underscores in the id (splits on the first separator only)", () => {
			const parsed = parseSessionCursor("1000_a_b_c");
			expect(parsed?.id).toBe("a_b_c");
			expect(parsed?.sessionDate.getTime()).toBe(1000);
		});

		it("returns null when the separator is missing", () => {
			expect(parseSessionCursor("12345")).toBeNull();
		});

		it("returns null for a non-integer timestamp", () => {
			expect(parseSessionCursor("abc_s1")).toBeNull();
		});

		it("returns null for an empty timestamp", () => {
			expect(parseSessionCursor("_s1")).toBeNull();
		});

		it("returns null for an empty id", () => {
			expect(parseSessionCursor("1000_")).toBeNull();
		});
	});

	it("getById accepts {id}", () => {
		const schema = (
			appRouter.session.getById as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1" }).success).toBe(true);
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("update accepts id-only payload", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1" }).success).toBe(true);
	});

	it("update rejects negative buyIn", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1", buyIn: -1 }).success).toBe(false);
	});

	it("update rejects placement < 1", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1", placement: 0 }).success).toBe(false);
	});

	it("create accepts cash session with snapshot override fields", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...CASH_BASE,
				ruleName: "1/2 NLH (this session)",
				minBuyIn: 100,
				maxBuyIn: 400,
				tableSize: 9,
			}).success
		).toBe(true);
	});

	it("create rejects empty ruleName on cash session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ ...CASH_BASE, ruleName: "" }).success).toBe(
			false
		);
	});

	it("create accepts tournament session with snapshot override fields and structure arrays", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				ruleName: "Main Event (session-only)",
				variant: "nlh",
				startingStack: 20_000,
				bountyAmount: 500,
				tableSize: 9,
				blindLevels: [
					{
						isBreak: false,
						blind1: 100,
						blind2: 200,
						blind3: null,
						ante: null,
						minutes: 15,
					},
				],
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			}).success
		).toBe(true);
	});

	it("create accepts chipPurchases carrying an explicit count", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000, count: 3 }],
			}).success
		).toBe(true);
	});

	it("create rejects a negative chip purchase count", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000, count: -1 }],
			}).success
		).toBe(false);
	});

	it("create no longer accepts the legacy rebuyCount field as a real column", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				data?: Record<string, unknown>;
				success: boolean;
			};
		};
		const parsed = schema.safeParse({ ...TOURNAMENT_BASE, rebuyCount: 5 });
		expect(parsed.success).toBe(true);
		// Zod strips the unknown legacy key — it never reaches the DB layer.
		expect(parsed.data?.rebuyCount).toBeUndefined();
	});

	it("create rejects a blind level missing isBreak on tournament session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				blindLevels: [{ blind1: 100 }],
			}).success
		).toBe(false);
	});

	it("update accepts explicit null clears for nullable link fields", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				id: "s1",
				roomId: null,
				ringGameId: null,
				tournamentId: null,
				currencyId: null,
			}).success
		).toBe(true);
	});

	it("delete rejects missing id", () => {
		const schema = (
			appRouter.session.delete as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({}).success).toBe(false);
	});
});

describe("assertNoLiveLinkedRestrictedEdits", () => {
	const manualCashSession = {
		kind: "cash_game",
		source: "manual",
	};

	const liveCashSession = {
		kind: "cash_game",
		source: "live",
	};

	const liveTournamentSession = {
		kind: "tournament",
		source: "live",
	};

	it("allows arbitrary field edits for non-live-linked sessions", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(manualCashSession, {
				buyIn: 1000,
				cashOut: 2000,
				memo: "edited",
			})
		).not.toThrow();
	});

	it("rejects buyIn edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { buyIn: 5000 })
		).toThrow(TRPCError);
	});

	it("rejects cashOut edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { cashOut: 5000 })
		).toThrow(DERIVED_FIELDS_RE);
	});

	it("rejects ring-game config edits on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				variant: "plo",
				blind1: 2,
				blind2: 5,
			})
		).toThrow(RING_CONFIG_RE);
	});

	it("rejects sessionDate edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				sessionDate: 1_700_000_000,
			})
		).toThrow(SESSION_DATE_RE);
	});

	it("rejects placement edit on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				placement: 3,
			})
		).toThrow(PLACEMENT_RE);
	});

	it("rejects prizeMoney edit on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				prizeMoney: 10_000,
			})
		).toThrow(PRIZE_MONEY_RE);
	});

	it("rejects tournamentId retarget on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				tournamentId: "some-other-tournament",
			})
		).toThrow(TOURNAMENT_ID_RE);
	});

	it("allows memo edit on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { memo: "new memo" })
		).not.toThrow();
	});

	it("allows roomId and currencyId edits on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				roomId: "room-1",
				currencyId: "currency-1",
			})
		).not.toThrow();
	});

	it("allows tagIds edit on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				tagIds: ["tag-1", "tag-2"],
			})
		).not.toThrow();
	});

	it("lists all violating fields in the error message", () => {
		try {
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				buyIn: 1,
				cashOut: 2,
				evCashOut: 3,
			});
			throw new Error("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			const message = (error as TRPCError).message;
			expect(message).toContain("buyIn");
			expect(message).toContain("cashOut");
			expect(message).toContain("evCashOut");
		}
	});

	it("uses BAD_REQUEST error code", () => {
		try {
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { buyIn: 1 });
			throw new Error("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("applies cash field list only to cash sessions (not tournament fields)", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { placement: 1 })
		).not.toThrow();
	});

	it("applies tournament field list only to tournament sessions (not cash fields)", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, { buyIn: 1 })
		).not.toThrow();
	});

	it("ignores fields whose value is undefined", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				buyIn: undefined,
				memo: "ok",
			})
		).not.toThrow();
	});
});

describe("computeTournamentPL", () => {
	it("subtracts buy-in, entry fee, and chip purchase cost from prize income", () => {
		// income (1000 + 200) - cost (500 + 50 + 300) = 1200 - 850 = 350
		expect(computeTournamentPL(500, 50, 300, 1000, 200)).toBe(350);
	});

	it("treats null buy-in / entry fee / prizes as zero", () => {
		expect(computeTournamentPL(null, null, 0, null, null)).toBe(0);
	});

	it("returns a loss when chip purchases exceed income", () => {
		// income 0 - cost (100 + 0 + 250) = -350
		expect(computeTournamentPL(100, null, 250, null, null)).toBe(-350);
	});

	it("adds bounty prizes to income", () => {
		// income (0 + 400) - cost (100 + 0 + 0) = 300
		expect(computeTournamentPL(100, 0, 0, 0, 400)).toBe(300);
	});
});
