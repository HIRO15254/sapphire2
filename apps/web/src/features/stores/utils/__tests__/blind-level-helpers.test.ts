import type { DragEndEvent } from "@dnd-kit/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import {
	addLevel,
	createLevel,
	deleteLevel,
	getEffectiveLastMinutes,
	reorderLevels,
	updateLevel,
} from "@/features/stores/utils/blind-level-helpers";

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
});
