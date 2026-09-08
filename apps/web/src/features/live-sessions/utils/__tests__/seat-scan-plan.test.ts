import { describe, expect, it } from "vitest";
import {
	planScanCommit,
	projectScanPlan,
} from "@/features/live-sessions/utils/seat-scan-plan";
import type { ScanRow } from "@/features/live-sessions/utils/seat-scan-review";

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

describe("planScanCommit", () => {
	it("moves a player who is already seated instead of adding them again", () => {
		expect(planScanCommit([scanRow({})], new Set(["p-y"]))).toEqual([
			{ kind: "moveExisting", playerId: "p-y", seatPosition: 6 },
		]);
	});

	it("adds a known player who is not at the table yet", () => {
		expect(planScanCommit([scanRow({})], new Set())).toEqual([
			{ kind: "seatExisting", name: "Y", playerId: "p-y", seatPosition: 6 },
		]);
	});

	it("registers an unmatched name as a new player", () => {
		expect(
			planScanCommit(
				[scanRow({ kind: "new", matchedPlayerId: null, name: "Blue shirt" })],
				new Set()
			)
		).toEqual([{ kind: "seatNew", name: "Blue shirt", seatPosition: 6 }]);
	});

	it("skips an unmatched row whose name was cleared", () => {
		expect(
			planScanCommit(
				[scanRow({ kind: "new", matchedPlayerId: null, name: "  " })],
				new Set()
			)
		).toEqual([]);
	});

	it("seats the incoming player before removing the one being replaced", () => {
		expect(
			planScanCommit(
				[
					scanRow({
						currentName: "X",
						currentPlayerId: "p-x",
						kind: "conflict",
					}),
				],
				new Set(["p-y"])
			)
		).toEqual([
			{ kind: "moveExisting", playerId: "p-y", seatPosition: 6 },
			{ kind: "leave", playerId: "p-x" },
		]);
	});

	it("does not remove the seat's current player when they are the incoming player", () => {
		expect(
			planScanCommit(
				[
					scanRow({
						currentName: "Y old",
						currentPlayerId: "p-y",
						kind: "conflict",
					}),
				],
				new Set(["p-y"])
			)
		).toEqual([{ kind: "moveExisting", playerId: "p-y", seatPosition: 6 }]);
	});

	it("swaps two seated players without dropping either of them", () => {
		const steps = planScanCommit(
			[
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
			],
			new Set(["p-x", "p-y"])
		);

		expect(steps).toEqual([
			{ kind: "moveExisting", playerId: "p-y", seatPosition: 2 },
			{ kind: "moveExisting", playerId: "p-x", seatPosition: 4 },
		]);
	});

	it("moves a displaced player on to the seat the scan gives them", () => {
		const steps = planScanCommit(
			[
				scanRow({
					currentName: "X",
					currentPlayerId: "p-x",
					kind: "conflict",
					matchedPlayerId: "p-y",
					seatPosition: 2,
				}),
				scanRow({ matchedPlayerId: "p-x", name: "X", seatPosition: 4 }),
			],
			new Set(["p-x"])
		);

		expect(steps).toEqual([
			{ kind: "seatExisting", name: "Y", playerId: "p-y", seatPosition: 2 },
			{ kind: "moveExisting", playerId: "p-x", seatPosition: 4 },
		]);
	});

	it("adds a player back who an earlier row took off the table", () => {
		const steps = planScanCommit(
			[
				scanRow({
					currentName: "X",
					currentPlayerId: "p-x",
					kind: "vacate",
					matchedPlayerId: null,
					name: "",
					seatPosition: 2,
				}),
				scanRow({ matchedPlayerId: "p-x", name: "X", seatPosition: 4 }),
			],
			new Set(["p-x", "p-y"])
		);

		expect(steps).toEqual([
			{ kind: "moveExisting", playerId: "p-x", seatPosition: 4 },
		]);
	});

	it("frees a seat the scan read as empty", () => {
		expect(
			planScanCommit(
				[
					scanRow({
						currentName: "X",
						currentPlayerId: "p-x",
						kind: "vacate",
						matchedPlayerId: null,
						name: "",
					}),
				],
				new Set(["p-x"])
			)
		).toEqual([{ kind: "leave", playerId: "p-x" }]);
	});

	it("keeps a player the scan read as gone when another row re-seats them", () => {
		const steps = planScanCommit(
			[
				scanRow({
					currentName: "X",
					currentPlayerId: "p-x",
					kind: "vacate",
					matchedPlayerId: null,
					name: "",
				}),
				scanRow({ matchedPlayerId: "p-x", name: "X", seatPosition: 4 }),
			],
			new Set(["p-x"])
		);

		expect(steps).toEqual([
			{ kind: "moveExisting", playerId: "p-x", seatPosition: 4 },
		]);
	});

	it("clears the hero seat when a scanned player takes it over", () => {
		expect(
			planScanCommit(
				[
					scanRow({
						currentName: "You",
						displacesHero: true,
						kind: "conflict",
					}),
				],
				new Set()
			)
		).toEqual([
			{ kind: "seatExisting", name: "Y", playerId: "p-y", seatPosition: 6 },
			{ kind: "clearHero" },
		]);
	});

	it("leaves the hero seat alone when another row moves it instead", () => {
		const steps = planScanCommit(
			[
				scanRow({ currentName: "You", displacesHero: true, kind: "conflict" }),
				scanRow({
					kind: "hero",
					matchedPlayerId: null,
					name: "",
					seatPosition: 1,
				}),
			],
			new Set()
		);

		expect(steps).toEqual([
			{ kind: "seatExisting", name: "Y", playerId: "p-y", seatPosition: 6 },
			{ kind: "moveHero", seatPosition: 1 },
		]);
	});
});

describe("projectScanPlan", () => {
	const JOINED_AT = "2026-06-01T12:00:00.000Z";

	function item(playerId: string, name: string, seatPosition: number | null) {
		return {
			id: `tp-${playerId}`,
			isActive: true,
			joinedAt: JOINED_AT,
			leftAt: null,
			player: { id: playerId, isTemporary: false, memo: null, name },
			seatPosition,
			stints: [] as { seatPosition: number | null }[],
		};
	}

	it("moves a seated player to the scanned seat", () => {
		const next = projectScanPlan(
			[item("p-x", "X", 2)],
			[{ kind: "moveExisting", playerId: "p-x", seatPosition: 5 }],
			JOINED_AT
		);

		expect(next).toEqual([expect.objectContaining({ seatPosition: 5 })]);
	});

	it("takes a player who left off the table", () => {
		const next = projectScanPlan(
			[item("p-x", "X", 2)],
			[{ kind: "leave", playerId: "p-x" }],
			JOINED_AT
		);

		expect(next[0]).toMatchObject({ isActive: false, seatPosition: null });
	});

	it("adds a row for each newly seated player", () => {
		const next = projectScanPlan(
			[],
			[
				{ kind: "seatExisting", name: "Y", playerId: "p-y", seatPosition: 6 },
				{ kind: "seatNew", name: "Blue shirt", seatPosition: 7 },
			],
			JOINED_AT
		);

		expect(next).toHaveLength(2);
		expect(next[0]).toMatchObject({
			isActive: true,
			player: { id: "p-y", name: "Y" },
			seatPosition: 6,
		});
		expect(next[1]).toMatchObject({
			player: { name: "Blue shirt" },
			seatPosition: 7,
		});
		expect(next[1]?.player.id).not.toBe(next[0]?.player.id);
	});

	it("leaves the table untouched for hero-only steps", () => {
		const items = [item("p-x", "X", 2)];

		expect(
			projectScanPlan(
				items,
				[{ kind: "moveHero", seatPosition: 1 }, { kind: "clearHero" }],
				JOINED_AT
			)
		).toEqual(items);
	});
});
