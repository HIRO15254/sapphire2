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
});

describe("assertNoLiveLinkedRestrictedEdits", () => {
	const manualCashSession = {
		type: "cash_game",
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
	};

	const liveCashSession = {
		type: "cash_game",
		liveCashGameSessionId: "live-cash-1",
		liveTournamentSessionId: null,
	};

	const liveTournamentSession = {
		type: "tournament",
		liveCashGameSessionId: null,
		liveTournamentSessionId: "live-tournament-1",
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
