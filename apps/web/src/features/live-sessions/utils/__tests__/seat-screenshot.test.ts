import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScanRow } from "@/features/live-sessions/utils/seat-scan-review";
import {
	ACCEPTED_TYPES,
	applyRowAction,
	applyScanRow,
	buildRow,
	computeRowAction,
	computeRowWarning,
	isAcceptedMediaType,
	normalizeName,
	type ReviewRow,
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

describe("applyScanRow", () => {
	const SESSION = { liveCashGameSessionId: "s1" };
	const seat = trpcClient.sessionTablePlayer;

	function scanRow(overrides: Partial<ScanRow>): ScanRow {
		return {
			currentName: null,
			currentPlayerId: null,
			displacesHero: false,
			isPickable: true,
			isSelectedByDefault: true,
			kind: "known",
			matchedPlayerId: "p-y",
			name: "Y",
			seatPosition: 6,
			...overrides,
		};
	}

	function apply(
		row: ScanRow,
		activePlayerIds: Set<string>,
		incomingPlayerIds: Set<string>,
		isHeroMoving = false
	) {
		return applyScanRow(row, SESSION, {
			activePlayerIds,
			incomingPlayerIds,
			isHeroMoving,
		});
	}

	beforeEach(() => {
		vi.mocked(seat.add.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.addNew.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.remove.mutate).mockReset().mockResolvedValue(undefined);
		vi.mocked(seat.updateSeat.mutate).mockReset().mockResolvedValue(undefined);
	});

	it("moves a player who is already seated in this session instead of adding them", async () => {
		const ok = await apply(scanRow({}), new Set(["p-y"]), new Set(["p-y"]));

		expect(ok).toBe(true);
		expect(seat.updateSeat.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-y",
			seatPosition: 6,
		});
		expect(seat.add.mutate).not.toHaveBeenCalled();
	});

	it("adds a known player who is not at the table yet", async () => {
		const ok = await apply(scanRow({}), new Set(), new Set(["p-y"]));

		expect(ok).toBe(true);
		expect(seat.add.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-y",
			seatPosition: 6,
		});
		expect(seat.updateSeat.mutate).not.toHaveBeenCalled();
	});

	it("seats the incoming player before removing the one being replaced", async () => {
		const order: string[] = [];
		vi.mocked(seat.updateSeat.mutate).mockImplementation(() => {
			order.push("updateSeat");
			return Promise.resolve(undefined);
		});
		vi.mocked(seat.remove.mutate).mockImplementation(() => {
			order.push("remove");
			return Promise.resolve(undefined);
		});

		const ok = await apply(
			scanRow({ currentName: "X", currentPlayerId: "p-x", kind: "conflict" }),
			new Set(["p-y"]),
			new Set(["p-y"])
		);

		expect(ok).toBe(true);
		expect(order).toEqual(["updateSeat", "remove"]);
	});

	it("keeps the replaced player at the table when seating the incoming one fails", async () => {
		vi.mocked(seat.add.mutate).mockRejectedValue(new Error("already active"));

		const ok = await apply(
			scanRow({ currentName: "X", currentPlayerId: "p-x", kind: "conflict" }),
			new Set(),
			new Set(["p-y"])
		);

		expect(ok).toBe(false);
		expect(seat.remove.mutate).not.toHaveBeenCalled();
	});

	it("does not remove the seat's current player when they are the incoming player", async () => {
		const ok = await apply(
			scanRow({
				currentName: "Y old",
				currentPlayerId: "p-y",
				kind: "conflict",
			}),
			new Set(["p-y"]),
			new Set(["p-y"])
		);

		expect(ok).toBe(true);
		expect(seat.remove.mutate).not.toHaveBeenCalled();
	});

	it("swaps two seated players without dropping either of them", async () => {
		const activeIds = new Set(["p-x", "p-y"]);
		const incomingIds = new Set(["p-x", "p-y"]);
		const swapRows = [
			scanRow({
				currentName: "X",
				currentPlayerId: "p-x",
				kind: "conflict",
				matchedPlayerId: "p-y",
				name: "Y",
				seatPosition: 2,
			}),
			scanRow({
				currentName: "Y",
				currentPlayerId: "p-y",
				kind: "conflict",
				matchedPlayerId: "p-x",
				name: "X",
				seatPosition: 4,
			}),
		];

		const results: boolean[] = [];
		for (const row of swapRows) {
			results.push(await apply(row, activeIds, incomingIds));
		}

		expect(results).toEqual([true, true]);
		expect(
			vi.mocked(seat.updateSeat.mutate).mock.calls.map(([c]) => c)
		).toEqual([
			{ liveCashGameSessionId: "s1", playerId: "p-y", seatPosition: 2 },
			{ liveCashGameSessionId: "s1", playerId: "p-x", seatPosition: 4 },
		]);
		expect(seat.remove.mutate).not.toHaveBeenCalled();
		expect(activeIds).toEqual(new Set(["p-x", "p-y"]));
	});

	it("re-seats a player an earlier row removed instead of moving a departed one", async () => {
		const activeIds = new Set(["p-x"]);
		const incomingIds = new Set(["p-y"]);

		await apply(
			scanRow({
				currentName: "X",
				currentPlayerId: "p-x",
				kind: "conflict",
				matchedPlayerId: "p-y",
				seatPosition: 2,
			}),
			activeIds,
			incomingIds
		);
		expect(activeIds.has("p-x")).toBe(false);

		const ok = await apply(
			scanRow({ matchedPlayerId: "p-x", name: "X", seatPosition: 4 }),
			activeIds,
			incomingIds
		);

		expect(ok).toBe(true);
		expect(seat.add.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-x",
			seatPosition: 4,
		});
	});

	it("frees a seat the scan read as empty", async () => {
		const activeIds = new Set(["p-x"]);
		const ok = await apply(
			scanRow({
				currentName: "X",
				currentPlayerId: "p-x",
				kind: "vacate",
				matchedPlayerId: null,
				name: "",
			}),
			activeIds,
			new Set()
		);

		expect(ok).toBe(true);
		expect(seat.remove.mutate).toHaveBeenCalledWith({
			liveCashGameSessionId: "s1",
			playerId: "p-x",
		});
		expect(activeIds.has("p-x")).toBe(false);
	});

	it("keeps a player the scan read as gone when another row re-seats them", async () => {
		const ok = await apply(
			scanRow({
				currentName: "X",
				currentPlayerId: "p-x",
				kind: "vacate",
				matchedPlayerId: null,
				name: "",
			}),
			new Set(["p-x"]),
			new Set(["p-x"])
		);

		expect(ok).toBe(true);
		expect(seat.remove.mutate).not.toHaveBeenCalled();
	});

	it("clears the hero seat when a scanned player takes it over", async () => {
		const hero = trpcClient.liveCashGameSession.updateHeroSeat;
		vi.mocked(hero.mutate).mockReset().mockResolvedValue(undefined);

		const ok = await apply(
			scanRow({
				currentName: "You",
				currentPlayerId: null,
				displacesHero: true,
				kind: "conflict",
			}),
			new Set(),
			new Set()
		);

		expect(ok).toBe(true);
		expect(hero.mutate).toHaveBeenCalledWith({
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("leaves the hero seat alone when another row moves it instead", async () => {
		const hero = trpcClient.liveCashGameSession.updateHeroSeat;
		vi.mocked(hero.mutate).mockReset().mockResolvedValue(undefined);

		const ok = await apply(
			scanRow({
				currentName: "You",
				currentPlayerId: null,
				displacesHero: true,
				kind: "conflict",
			}),
			new Set(),
			new Set(),
			true
		);

		expect(ok).toBe(true);
		expect(hero.mutate).not.toHaveBeenCalled();
	});

	it("skips an unmatched row whose name was cleared instead of sending an empty name", async () => {
		const ok = await apply(
			scanRow({ kind: "new", matchedPlayerId: null, name: "  " }),
			new Set(),
			new Set()
		);

		expect(ok).toBe(false);
		expect(seat.addNew.mutate).not.toHaveBeenCalled();
	});
});
