import type { DragEndEvent } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	addLevel,
	createLevel,
	deleteLevel,
	getEffectiveLastMinutes,
	parseIntOrNull,
	reorderLevels,
	toGameSetsPatch,
	toSingleSetPatch,
	updateLevel,
} from "@/features/rooms/utils/blind-level-helpers";

function level(overrides: Partial<BlindLevelRow> = {}): BlindLevelRow {
	return {
		id: "lvl-1",
		tournamentId: "tn-1",
		level: 1,
		isBreak: false,
		blind1: 100,
		blind2: 200,
		blind3: null,
		ante: null,
		minutes: 20,
		...overrides,
	} as BlindLevelRow;
}

describe("getEffectiveLastMinutes", () => {
	it("returns the supplied lastMinutes directly when not null", () => {
		expect(getEffectiveLastMinutes(15, [])).toBe(15);
	});

	it("returns null when there are no levels and lastMinutes is null", () => {
		expect(getEffectiveLastMinutes(null, [])).toBeNull();
	});

	it("walks levels from the end to find the last non-null minutes", () => {
		const levels: BlindLevelRow[] = [
			level({ id: "a", minutes: 10 }),
			level({ id: "b", minutes: 20 }),
			level({ id: "c", minutes: null }),
		];
		expect(getEffectiveLastMinutes(null, levels)).toBe(20);
	});

	it("returns null when all levels have null minutes", () => {
		const levels = [
			level({ id: "a", minutes: null }),
			level({ id: "b", minutes: null }),
		];
		expect(getEffectiveLastMinutes(null, levels)).toBeNull();
	});
});

describe("reorderLevels", () => {
	const levels: BlindLevelRow[] = [
		level({ id: "a", level: 1 }),
		level({ id: "b", level: 2 }),
		level({ id: "c", level: 3 }),
	];

	function dragEvent(activeId: string, overId: string | null): DragEndEvent {
		return {
			active: { id: activeId },
			over: overId === null ? null : { id: overId },
		} as unknown as DragEndEvent;
	}

	it("returns null when there is no over target", () => {
		expect(reorderLevels(levels, dragEvent("a", null))).toBeNull();
	});

	it("returns null when active and over are the same", () => {
		expect(reorderLevels(levels, dragEvent("a", "a"))).toBeNull();
	});

	it("returns null when the active id does not exist", () => {
		expect(reorderLevels(levels, dragEvent("missing", "b"))).toBeNull();
	});

	it("returns null when the over id does not exist", () => {
		expect(reorderLevels(levels, dragEvent("a", "missing"))).toBeNull();
	});

	it("moves active to the over position and renumbers levels", () => {
		const result = reorderLevels(levels, dragEvent("a", "c"));
		expect(result).not.toBeNull();
		expect(result?.map((l) => l.id)).toEqual(["b", "c", "a"]);
		expect(result?.map((l) => l.level)).toEqual([1, 2, 3]);
	});

	it("moves backwards correctly", () => {
		const result = reorderLevels(levels, dragEvent("c", "a"));
		expect(result?.map((l) => l.id)).toEqual(["c", "a", "b"]);
	});
});

describe("addLevel", () => {
	beforeEach(() => {
		vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
			"00000000-0000-0000-0000-000000000001"
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("appends a new level with next level number and seeded minutes", () => {
		const levels = [level({ id: "a", level: 1 })];
		const result = addLevel(levels, 25, false);
		expect(result).toHaveLength(2);
		expect(result[1]?.level).toBe(2);
		expect(result[1]?.minutes).toBe(25);
		expect(result[1]?.isBreak).toBe(false);
		expect(result[1]?.id).toBe("00000000-0000-0000-0000-000000000001");
	});

	it("copies over effectiveLastMinutes of null", () => {
		const result = addLevel([], null, false);
		expect(result[0]?.minutes).toBeNull();
	});

	it("marks a break level when isBreak=true", () => {
		const result = addLevel([], 10, true);
		expect(result[0]?.isBreak).toBe(true);
	});
});

describe("deleteLevel", () => {
	const levels: BlindLevelRow[] = [
		level({ id: "a", level: 1 }),
		level({ id: "b", level: 2 }),
		level({ id: "c", level: 3 }),
	];

	it("removes the target and renumbers remaining levels", () => {
		const result = deleteLevel(levels, "b");
		expect(result).toHaveLength(2);
		expect(result.map((l) => l.id)).toEqual(["a", "c"]);
		expect(result.map((l) => l.level)).toEqual([1, 2]);
	});

	it("returns an empty array when deleting the only level", () => {
		expect(deleteLevel([level({ id: "x", level: 1 })], "x")).toEqual([]);
	});

	it("is a no-op when id not found (but still renumbers)", () => {
		const result = deleteLevel(levels, "missing");
		expect(result).toHaveLength(3);
		expect(result.map((l) => l.level)).toEqual([1, 2, 3]);
	});
});

describe("updateLevel", () => {
	const levels: BlindLevelRow[] = [
		level({ id: "a", level: 1, blind1: 100 }),
		level({ id: "b", level: 2, blind1: 200 }),
	];

	it("applies updates to the matching level only", () => {
		const result = updateLevel(levels, "b", { blind1: 250 });
		expect(result[0]?.blind1).toBe(100);
		expect(result[1]?.blind1).toBe(250);
	});

	it("is a no-op when id not found", () => {
		const result = updateLevel(levels, "missing", { blind1: 999 });
		expect(result).toEqual(levels);
	});

	it("merges partial updates without touching other fields", () => {
		const result = updateLevel(levels, "a", { ante: 50 });
		expect(result[0]?.ante).toBe(50);
		expect(result[0]?.blind1).toBe(100);
	});
});

describe("createLevel", () => {
	beforeEach(() => {
		vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
			"00000000-0000-0000-0000-000000000002"
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("seeds from effectiveLastMinutes when vals.minutes is null", () => {
		const result = createLevel(
			[],
			{ ante: null, blind1: 100, blind2: 200, minutes: null },
			15
		);
		expect(result[0]?.minutes).toBe(15);
	});

	it("prefers vals.minutes when provided", () => {
		const result = createLevel(
			[],
			{ ante: null, blind1: 100, blind2: 200, minutes: 25 },
			15
		);
		expect(result[0]?.minutes).toBe(25);
	});

	it("copies blind and ante from vals", () => {
		const result = createLevel(
			[],
			{ ante: 10, blind1: 100, blind2: 200, minutes: 20 },
			null
		);
		expect(result[0]?.blind1).toBe(100);
		expect(result[0]?.blind2).toBe(200);
		expect(result[0]?.ante).toBe(10);
		expect(result[0]?.blind3).toBeNull();
	});

	it("numbers the new level as length+1", () => {
		const result = createLevel(
			[level({ id: "x", level: 1 }), level({ id: "y", level: 2 })],
			{ ante: null, blind1: 100, blind2: 200, minutes: 20 },
			null
		);
		expect(result[2]?.level).toBe(3);
	});

	it("is never a break level", () => {
		const result = createLevel(
			[],
			{ ante: null, blind1: 100, blind2: 200, minutes: 20 },
			null
		);
		expect(result[0]?.isBreak).toBe(false);
	});

	it("defaults games to null when vals omit them", () => {
		const result = createLevel(
			[],
			{ ante: null, blind1: 100, blind2: 200, minutes: 20 },
			null
		);
		expect(result[0]?.games).toBeNull();
	});

	it("carries per-game sets from vals.games", () => {
		const games = [
			{
				name: "Stud",
				variants: ["Razz"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: null,
			},
		];
		const result = createLevel(
			[],
			{ ante: null, blind1: null, blind2: null, minutes: 20, games },
			null
		);
		expect(result[0]?.games).toEqual(games);
	});
});

describe("parseIntOrNull", () => {
	it("returns null for the empty string", () => {
		expect(parseIntOrNull("")).toBeNull();
	});

	it("returns null for non-numeric text", () => {
		expect(parseIntOrNull("abc")).toBeNull();
	});

	it("parses plain digits", () => {
		expect(parseIntOrNull("200")).toBe(200);
	});

	it("parses a negative integer", () => {
		expect(parseIntOrNull("-5")).toBe(-5);
	});

	it("parses 0", () => {
		expect(parseIntOrNull("0")).toBe(0);
	});

	it("truncates decimal text to the integer part", () => {
		expect(parseIntOrNull("12.9")).toBe(12);
	});

	it("parses a leading-digits string and ignores the trailing text", () => {
		expect(parseIntOrNull("42abc")).toBe(42);
	});

	it("returns null for a whitespace-only string", () => {
		expect(parseIntOrNull("  ")).toBeNull();
	});

	it("returns null for 'Infinity' (parseInt yields NaN)", () => {
		expect(parseIntOrNull("Infinity")).toBeNull();
	});
});

describe("per-level game groups (mix tournaments)", () => {
	it("addLevel seeds games as null (no groups yet)", () => {
		const next = addLevel([], null, false);
		expect(next[0].games).toBeNull();
	});

	it("addLevel seeds the provided default game sets (mix-master tournaments)", () => {
		const games = [
			{
				name: null,
				variants: ["NL Hold'em"],
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
			},
		];
		const next = addLevel([], 20, false, games);
		expect(next[0].games).toEqual(games);
	});

	it("addLevel ignores default game sets for breaks", () => {
		const games = [
			{
				name: null,
				variants: ["NL Hold'em"],
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
			},
		];
		const next = addLevel([], 20, true, games);
		expect(next[0].games).toBeNull();
	});

	it("createLevel seeds games as null", () => {
		const next = createLevel(
			[],
			{ ante: null, blind1: 100, blind2: 200, minutes: 20 },
			null
		);
		expect(next[0].games).toBeNull();
	});

	it("updateLevel can set and clear a level's game groups", () => {
		const base = addLevel([], null, false);
		const games = [
			{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 },
		];
		const withGames = updateLevel(base, base[0].id, { games });
		expect(withGames[0].games).toEqual(games);
		const cleared = updateLevel(withGames, base[0].id, { games: null });
		expect(cleared[0].games).toBeNull();
	});
});

describe("toSingleSetPatch (collapse game sets → flat)", () => {
	it("clears games and carries the first set's amounts into the flat cells", () => {
		const patch = toSingleSetPatch([
			{
				name: "Limit",
				variants: ["Limit Hold'em"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: null,
			},
			{
				name: "Big Bet",
				variants: ["NL Hold'em"],
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 25,
			},
		]);
		expect(patch).toEqual({
			games: null,
			blind1: 400,
			blind2: 800,
			blind3: null,
			ante: null,
		});
	});

	it("carries a third blind slot from the first set", () => {
		const patch = toSingleSetPatch([
			{
				name: "Stud",
				variants: ["Razz"],
				blind1: 50,
				blind2: 100,
				blind3: 15,
				ante: 5,
			},
		]);
		expect(patch).toEqual({
			games: null,
			blind1: 50,
			blind2: 100,
			blind3: 15,
			ante: 5,
		});
	});

	it("nulls every flat cell when there are no game sets", () => {
		expect(toSingleSetPatch([])).toEqual({
			games: null,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
		});
		expect(toSingleSetPatch(null)).toEqual({
			games: null,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
		});
	});
});

describe("toGameSetsPatch (expand flat → game sets)", () => {
	const seeds = [
		{
			name: "Big Bet",
			variants: ["NL Hold'em"],
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
		},
		{
			name: "Stud",
			variants: ["Razz"],
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
		},
	];

	it("seeds the sets and carries the flat amounts into the first set only", () => {
		const patch = toGameSetsPatch(
			{ blind1: 100, blind2: 200, blind3: null, ante: 25 },
			seeds
		);
		expect(patch.games).toEqual([
			{
				name: "Big Bet",
				variants: ["NL Hold'em"],
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 25,
			},
			{
				name: "Stud",
				variants: ["Razz"],
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
			},
		]);
	});

	it("does not mutate the seed array", () => {
		const patch = toGameSetsPatch(
			{ blind1: 100, blind2: 200, blind3: null, ante: null },
			seeds
		);
		expect(patch.games?.[0]).not.toBe(seeds[0]);
		expect(seeds[0].blind1).toBeNull();
	});

	it("returns a flat clear when the composition is empty", () => {
		expect(
			toGameSetsPatch(
				{ blind1: 100, blind2: 200, blind3: null, ante: null },
				[]
			)
		).toEqual({ games: null });
	});
});
