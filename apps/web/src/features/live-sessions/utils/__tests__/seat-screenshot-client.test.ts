import { describe, expect, it, vi } from "vitest";
import {
	applyRow,
	type ReviewRow,
	type SessionParam,
	updateHeroSeatViaClient,
} from "@/features/live-sessions/utils/seat-screenshot";
import { trpcClient } from "@/utils/trpc";

vi.mock("@/utils/trpc", () => ({
	trpcClient: {
		liveCashGameSession: { updateHeroSeat: { mutate: vi.fn() } },
		liveTournamentSession: { updateHeroSeat: { mutate: vi.fn() } },
		sessionTablePlayer: {
			add: { mutate: vi.fn() },
			addNew: { mutate: vi.fn() },
		},
	},
}));

function row(overrides: Partial<ReviewRow> = {}): ReviewRow {
	return {
		rowId: "seat-1",
		action: "new",
		ambiguous: false,
		existingPlayerId: null,
		isHeroCandidate: false,
		matchedPlayerName: null,
		name: "Alice",
		seatNumber: 1,
		seatPosition: 0,
		warning: null,
		...overrides,
	};
}

describe("updateHeroSeatViaClient", () => {
	it.each([
		[
			"cash game session",
			{ liveCashGameSessionId: "cash-1" } satisfies SessionParam,
			trpcClient.liveCashGameSession.updateHeroSeat.mutate,
			{ id: "cash-1", heroSeatPosition: 3 },
		],
		[
			"tournament session",
			{ liveTournamentSessionId: "tourney-1" } satisfies SessionParam,
			trpcClient.liveTournamentSession.updateHeroSeat.mutate,
			{ id: "tourney-1", heroSeatPosition: 3 },
		],
	])("calls the %s mutate with the session id and heroSeatPosition", (_label, sessionParam, mutateFn, expectedArgs) => {
		updateHeroSeatViaClient(sessionParam, 3);
		expect(mutateFn).toHaveBeenCalledWith(expectedArgs);
	});

	it("throws for a sessionParam with neither a cash game nor a tournament id", () => {
		expect(() => updateHeroSeatViaClient({} as SessionParam, 3)).toThrow(
			"Invalid sessionParam: neither cash game nor tournament"
		);
	});
});

describe("applyRow", () => {
	const cashSession: SessionParam = { liveCashGameSessionId: "cash-1" };

	it.each([
		[
			"hero",
			row({ action: "hero", seatPosition: 4 }),
			trpcClient.liveCashGameSession.updateHeroSeat.mutate,
			{ id: "cash-1", heroSeatPosition: 4 },
		],
		[
			"existing",
			row({
				action: "existing",
				existingPlayerId: "pl-1",
				seatPosition: 2,
			}),
			trpcClient.sessionTablePlayer.add.mutate,
			{
				liveCashGameSessionId: "cash-1",
				playerId: "pl-1",
				seatPosition: 2,
			},
		],
		[
			"new",
			row({ action: "new", name: "  Bob  ", seatPosition: 5 }),
			trpcClient.sessionTablePlayer.addNew.mutate,
			{
				liveCashGameSessionId: "cash-1",
				playerName: "Bob",
				seatPosition: 5,
			},
		],
	])("calls the matching mutate for a %s row and resolves true", async (_label, reviewRow, mutateFn, expectedArgs) => {
		vi.mocked(mutateFn).mockResolvedValueOnce(undefined);
		const result = await applyRow(reviewRow, cashSession);
		expect(mutateFn).toHaveBeenCalledWith(expectedArgs);
		expect(result).toBe(true);
	});

	it("resolves false when the mutate call rejects", async () => {
		vi.mocked(
			trpcClient.sessionTablePlayer.addNew.mutate
		).mockRejectedValueOnce(new Error("network error"));
		const result = await applyRow(
			row({ action: "new", name: "Carol", seatPosition: 1 }),
			cashSession
		);
		expect(result).toBe(false);
	});
});
