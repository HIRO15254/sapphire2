import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { assertNoLiveLinkedRestrictedEdits } from "../routers/session";

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
				storeId: "s1",
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
				storeId: "st1",
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

	it("update accepts explicit null clears for nullable link fields", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				id: "s1",
				storeId: null,
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

	it("allows storeId and currencyId edits on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				storeId: "store-1",
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
