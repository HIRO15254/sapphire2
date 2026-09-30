import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ACCEPTED_TYPES,
	applyRowAction,
	buildRow,
	computeRowAction,
	computeRowWarning,
	isAcceptedMediaType,
	normalizeName,
	type ReviewRow,
	runSeatPlan,
} from "@/features/live-sessions/utils/seat-screenshot";
import { trpcClient } from "@/utils/trpc";

vi.mock("@/utils/trpc", () => ({
	trpcClient: {
		liveCashGameSession: { updateHeroSeat: { mutate: vi.fn() } },
		liveTournamentSession: { updateHeroSeat: { mutate: vi.fn() } },
		sessionTablePlayer: {
			add: { mutate: vi.fn() },
			addNew: { mutate: vi.fn() },
			remove: { mutate: vi.fn() },
			updateSeat: { mutate: vi.fn() },
		},
	},
}));

describe("isAcceptedMediaType", () => {
	it("accepts declared image types", () => {
		for (const type of ACCEPTED_TYPES) {
			expect(isAcceptedMediaType(type)).toBe(true);
		}
	});

	it("rejects non-declared types", () => {
		expect(isAcceptedMediaType("application/pdf")).toBe(false);
		expect(isAcceptedMediaType("image/tiff")).toBe(false);
		expect(isAcceptedMediaType("")).toBe(false);
	});
});

describe("normalizeName", () => {
	it("lowercases and trims", () => {
		expect(normalizeName("  Alice  ")).toBe("alice");
	});

	it("collapses only surrounding whitespace", () => {
		expect(normalizeName("  Alice Bob  ")).toBe("alice bob");
	});

	it("returns empty for blank input", () => {
		expect(normalizeName("   ")).toBe("");
	});
});

describe("applyRowAction", () => {
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

	it("updates the matching row's action", () => {
		const before = row({ rowId: "seat-2", action: "new" });
		const after = applyRowAction(before, "seat-2", "hero");
		expect(after.action).toBe("hero");
	});

	it("does NOT mutate the input row (returns a new object)", () => {
		const before = row({ rowId: "seat-2" });
		const after = applyRowAction(before, "seat-2", "hero");
		expect(after).not.toBe(before);
	});

	it("demotes another row from hero when a new hero is selected (existing player)", () => {
		const other = row({
			rowId: "seat-1",
			action: "hero",
			existingPlayerId: "pl-1",
		});
		const result = applyRowAction(other, "seat-2", "hero");
		expect(result.action).toBe("existing");
	});

	it("demotes another row from hero when new hero selected (no existing player)", () => {
		const other = row({
			rowId: "seat-1",
			action: "hero",
			existingPlayerId: null,
		});
		const result = applyRowAction(other, "seat-2", "hero");
		expect(result.action).toBe("new");
	});

	it("does NOT demote non-hero other rows", () => {
		const other = row({ rowId: "seat-1", action: "existing" });
		const result = applyRowAction(other, "seat-2", "hero");
		expect(result).toBe(other);
	});

	it("blocks switching an ambiguous row to 'existing'", () => {
		const r = row({ ambiguous: true, action: "new" });
		const result = applyRowAction(r, "seat-1", "existing");
		expect(result.action).toBe("new");
	});

	it("allows other actions on ambiguous rows", () => {
		const r = row({ ambiguous: true, action: "existing" });
		const result = applyRowAction(r, "seat-1", "skip");
		expect(result.action).toBe("skip");
	});
});

describe("computeRowWarning", () => {
	it("warns on out-of-range seat position (<0)", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set(),
				seatNumber: 1,
				seatPosition: -1,
			})
		).toBe("Seat 1 is out of range (1-9).");
	});

	it("warns on out-of-range seat position (>8)", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set(),
				seatNumber: 10,
				seatPosition: 9,
			})
		).toBe("Seat 10 is out of range (1-9).");
	});

	it("warns when a seat exceeds the current table size", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set(),
				seatCount: 6,
				seatNumber: 7,
				seatPosition: 6,
			})
		).toBe("Seat 7 is out of range (1-6).");
	});

	it("accepts the last seat in the current table size", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set(),
				seatCount: 6,
				seatNumber: 6,
				seatPosition: 5,
			})
		).toBeNull();
	});
	it("warns when seat is already occupied for non-hero, non-skip actions", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set([3]),
				seatNumber: 4,
				seatPosition: 3,
			})
		).toBe("Seat 4 is already occupied.");
	});

	it("does NOT warn for hero action on occupied seat", () => {
		expect(
			computeRowWarning({
				action: "hero",
				occupiedSeatPositions: new Set([3]),
				seatNumber: 4,
				seatPosition: 3,
			})
		).toBeNull();
	});

	it("does NOT warn for skip action on occupied seat", () => {
		expect(
			computeRowWarning({
				action: "skip",
				occupiedSeatPositions: new Set([3]),
				seatNumber: 4,
				seatPosition: 3,
			})
		).toBeNull();
	});

	it("returns null for clean non-occupied seat", () => {
		expect(
			computeRowWarning({
				action: "new",
				occupiedSeatPositions: new Set(),
				seatNumber: 1,
				seatPosition: 0,
			})
		).toBeNull();
	});
});

describe("computeRowAction", () => {
	const match = { id: "pl-1", name: "Alice" };

	it("returns 'hero' when explicit hero with no preferred action", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: undefined,
				isHeroCandidate: true,
				matchedPlayer: null,
				trimmedName: "Hero",
			})
		).toBe("hero");
	});

	it("returns 'skip' for empty trimmedName with no preference", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: undefined,
				isHeroCandidate: false,
				matchedPlayer: null,
				trimmedName: "",
			})
		).toBe("skip");
	});

	it("returns 'existing' when matched player exists", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: undefined,
				isHeroCandidate: false,
				matchedPlayer: match,
				trimmedName: "Alice",
			})
		).toBe("existing");
	});

	it("returns 'new' when no match and non-empty name", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: undefined,
				isHeroCandidate: false,
				matchedPlayer: null,
				trimmedName: "Bob",
			})
		).toBe("new");
	});

	it("respects preferredAction when valid", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: "hero",
				isHeroCandidate: false,
				matchedPlayer: null,
				trimmedName: "Alice",
			})
		).toBe("hero");
	});

	it("downgrades preferred 'existing' to 'new' when no matchedPlayer", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: "existing",
				isHeroCandidate: false,
				matchedPlayer: null,
				trimmedName: "Alice",
			})
		).toBe("new");
	});

	it("downgrades preferred 'new' to 'skip' when trimmedName is empty", () => {
		expect(
			computeRowAction({
				effectivePreferredAction: "new",
				isHeroCandidate: false,
				matchedPlayer: null,
				trimmedName: "",
			})
		).toBe("skip");
	});
});

describe("buildRow", () => {
	const players = new Map<
		string,
		{ id: string; name: string; count: number }[]
	>([
		["alice", [{ id: "pl-1", name: "Alice", count: 3 }]],
		[
			"bob",
			[
				{ id: "pl-2a", name: "Bob", count: 1 },
				{ id: "pl-2b", name: "Bob", count: 1 },
			],
		],
	]);

	it("matches an existing player (unique)", () => {
		const row = buildRow({
			isHero: false,
			name: "Alice",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 1,
			seatPosition: 0,
		});
		expect(row.action).toBe("existing");
		expect(row.existingPlayerId).toBe("pl-1");
		expect(row.matchedPlayerName).toBe("Alice");
		expect(row.ambiguous).toBe(false);
	});

	it("marks ambiguous when multiple players normalize the same", () => {
		const row = buildRow({
			isHero: false,
			name: "Bob",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 2,
			seatPosition: 1,
		});
		expect(row.ambiguous).toBe(true);
		expect(row.existingPlayerId).toBeNull();
		expect(row.action).toBe("new");
	});

	it("sets action='hero' for hero candidate", () => {
		const row = buildRow({
			isHero: true,
			name: "Hero",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 3,
			seatPosition: 2,
		});
		expect(row.action).toBe("hero");
		expect(row.isHeroCandidate).toBe(true);
	});

	it("skip on empty trimmed name", () => {
		const row = buildRow({
			isHero: false,
			name: "   ",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 4,
			seatPosition: 3,
		});
		expect(row.action).toBe("skip");
		expect(row.name).toBe("");
	});

	it("carries warning when seat is already occupied", () => {
		const row = buildRow({
			isHero: false,
			name: "Carol",
			occupiedSeatPositions: new Set([0]),
			playersByNormalizedName: players,
			seatNumber: 1,
			seatPosition: 0,
		});
		expect(row.warning).toBe("Seat 1 is already occupied.");
	});

	it("honors a preferredAction override", () => {
		const row = buildRow({
			isHero: false,
			name: "Alice",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			preferredAction: "skip",
			seatNumber: 1,
			seatPosition: 0,
		});
		expect(row.action).toBe("skip");
	});

	it("trims the name in the row", () => {
		const row = buildRow({
			isHero: false,
			name: "  Alice  ",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 1,
			seatPosition: 0,
		});
		expect(row.name).toBe("Alice");
	});

	it("rowId is seat-<seatNumber>", () => {
		const row = buildRow({
			isHero: false,
			name: "Alice",
			occupiedSeatPositions: new Set(),
			playersByNormalizedName: players,
			seatNumber: 7,
			seatPosition: 6,
		});
		expect(row.rowId).toBe("seat-7");
	});
});

describe("runSeatPlan", () => {
	const SESSION = { liveCashGameSessionId: "s1" };
	const seat = trpcClient.sessionTablePlayer;

	beforeEach(() => {
		vi.mocked(seat.add.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.addNew.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.remove.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.updateSeat.mutate).mockReset().mockResolvedValue(undefined);
	});

	it("sends each step to the procedure that performs it, in order", async () => {
		const order: string[] = [];
		for (const [label, spy] of [
			["leave", seat.remove.mutate],
			["moveExisting", seat.updateSeat.mutate],
			["seatExisting", seat.add.mutate],
			["seatNew", seat.addNew.mutate],
		] as const) {
			vi.mocked(spy).mockImplementation(() => {
				order.push(label);
				return Promise.resolve(undefined);
			});
		}

		const failures = await runSeatPlan(
			[
				{
					displaces: null,
					kind: "seatExisting",
					name: "Y",
					playerId: "p-y",
					seatPosition: 6,
				},
				{ kind: "leave", playerId: "p-x" },
				{
					displaces: null,
					kind: "moveExisting",
					playerId: "p-z",
					seatPosition: 1,
				},
				{
					displaces: null,
					kind: "seatNew",
					name: "Blue shirt",
					seatPosition: 3,
				},
			],
			SESSION
		);

		expect(failures).toBe(0);
		expect(order).toEqual(["seatExisting", "leave", "moveExisting", "seatNew"]);
		expect(seat.add.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-y",
			seatPosition: 6,
		});
		expect(seat.addNew.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerName: "Blue shirt",
			seatPosition: 3,
		});
	});

	it("counts a rejected step and keeps applying the rest", async () => {
		vi.mocked(seat.add.mutate).mockRejectedValue(new Error("already active"));

		const failures = await runSeatPlan(
			[
				{
					displaces: null,
					kind: "seatExisting",
					name: "Y",
					playerId: "p-y",
					seatPosition: 6,
				},
				{ kind: "leave", playerId: "p-x" },
			],
			SESSION
		);

		expect(failures).toBe(1);
		expect(seat.remove.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-x",
		});
	});

	it("removes the replaced player only after the incoming one is seated", async () => {
		const order: string[] = [];
		vi.mocked(seat.add.mutate).mockImplementation(() => {
			order.push("add");
			return Promise.resolve(undefined);
		});
		vi.mocked(seat.remove.mutate).mockImplementation(() => {
			order.push("remove");
			return Promise.resolve(undefined);
		});

		const failures = await runSeatPlan(
			[
				{
					displaces: "p-x",
					kind: "seatExisting",
					name: "Y",
					playerId: "p-y",
					seatPosition: 6,
				},
			],
			SESSION
		);

		expect(failures).toBe(0);
		expect(order).toEqual(["add", "remove"]);
		expect(seat.remove.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-x",
		});
	});

	it("keeps the replaced player at the table when seating the incoming one fails", async () => {
		vi.mocked(seat.add.mutate).mockRejectedValue(new Error("already active"));

		const failures = await runSeatPlan(
			[
				{
					displaces: "p-x",
					kind: "seatExisting",
					name: "Y",
					playerId: "p-y",
					seatPosition: 6,
				},
			],
			SESSION
		);

		expect(failures).toBe(1);
		expect(seat.remove.mutate).not.toHaveBeenCalled();
	});
});
