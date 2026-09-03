import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBlindStructureTable } from "@/features/rooms/components/blind-level-editor/blind-structure-table/use-blind-structure-table";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { MixGroupInfo, ResolveGroup } from "@/shared/lib/mix-games";

function row(partial: Partial<BlindLevelRow>): BlindLevelRow {
	return {
		id: crypto.randomUUID(),
		tournamentId: "",
		level: 1,
		isBreak: false,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: null,
		games: null,
		...partial,
	};
}

function gameSet(partial: Partial<LevelGameGroup>): LevelGameGroup {
	return {
		name: null,
		variants: ["Variant A"],
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		...partial,
	};
}

const groupA: MixGroupInfo = {
	id: "grpA",
	label: "Game A",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: null,
	sortIndex: 0,
};

const groupB: MixGroupInfo = {
	id: "grpB",
	label: "Game B",
	blind1Label: "Ante",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 1,
};

function makeResolveGroup(): ResolveGroup {
	return (variantLabel: string) => {
		if (variantLabel === "Variant A") {
			return groupA;
		}
		if (variantLabel === "Variant B") {
			return groupB;
		}
		return { ...groupA, id: "unknown" };
	};
}

describe("useBlindStructureTable", () => {
	it("initializes with a null openLevel", () => {
		const { result } = renderHook(() =>
			useBlindStructureTable([], { hybridGames: false })
		);
		expect(result.current.openLevel).toBe(null);
	});

	it("openGamesFor sets openLevel to the matching row", () => {
		const levels: BlindLevelRow[] = [row({ id: "a" }), row({ id: "b" })];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, { hybridGames: false })
		);
		act(() => {
			result.current.openGamesFor("b");
		});
		expect(result.current.openLevel?.id).toBe("b");
	});

	it("closeGames clears openLevel back to null", () => {
		const levels: BlindLevelRow[] = [row({ id: "a" })];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, { hybridGames: false })
		);
		act(() => {
			result.current.openGamesFor("a");
		});
		expect(result.current.openLevel?.id).toBe("a");
		act(() => {
			result.current.closeGames();
		});
		expect(result.current.openLevel).toBe(null);
	});

	it("returns null headerGroups when hybridGames is false", () => {
		const defaultGames: LevelGameGroup[] = [
			gameSet({ variants: ["Variant A"] }),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable([], {
				hybridGames: false,
				defaultGames,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.headerGroups).toBe(null);
	});

	it("returns null headerGroups when a level's games do not match the default composition", () => {
		const defaultGames: LevelGameGroup[] = [
			gameSet({ variants: ["Variant A"] }),
			gameSet({ variants: ["Variant B"] }),
		];
		const levels: BlindLevelRow[] = [
			row({
				id: "a",
				games: [gameSet({ variants: ["Variant B"] })],
			}),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, {
				hybridGames: true,
				defaultGames,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.headerGroups).toBe(null);
	});

	it("treats a break level as compatible regardless of composition, still computing headerGroups", () => {
		const defaultGames: LevelGameGroup[] = [
			gameSet({ variants: ["Variant A"] }),
		];
		const levels: BlindLevelRow[] = [
			row({ id: "a", games: [gameSet({ variants: ["Variant A"] })] }),
			row({ id: "b", isBreak: true, games: null }),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, {
				hybridGames: true,
				defaultGames,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.headerGroups).toEqual([
			{
				key: "Variant A",
				label: groupA.label,
				blind1Label: groupA.blind1Label,
				blind2Label: groupA.blind2Label,
				blind3Label: groupA.blind3Label,
			},
		]);
	});

	it("computes headerGroups keyed and labeled from defaultGames when composition matches", () => {
		const defaultGames: LevelGameGroup[] = [
			gameSet({ variants: ["Variant A"] }),
			gameSet({ variants: ["Variant B"] }),
		];
		const levels: BlindLevelRow[] = [
			row({
				id: "a",
				games: [
					gameSet({ variants: ["Variant A"] }),
					gameSet({ variants: ["Variant B"] }),
				],
			}),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, {
				hybridGames: true,
				defaultGames,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.headerGroups).toEqual([
			{
				key: "Variant A",
				label: groupA.label,
				blind1Label: groupA.blind1Label,
				blind2Label: groupA.blind2Label,
				blind3Label: groupA.blind3Label,
			},
			{
				key: "Variant B",
				label: groupB.label,
				blind1Label: groupB.blind1Label,
				blind2Label: groupB.blind2Label,
				blind3Label: groupB.blind3Label,
			},
		]);
	});

	it("computes hasBlind3Column true for a plain variant with a blind3Label when hybridGames is false", () => {
		const { result } = renderHook(() =>
			useBlindStructureTable([], {
				hybridGames: false,
				plainBlind3Label: "Straddle",
			})
		);
		expect(result.current.hasBlind3Column).toBe(true);
	});

	it("computes hasBlind3Column false for a plain variant without a blind3Label when hybridGames is false", () => {
		const { result } = renderHook(() =>
			useBlindStructureTable([], {
				hybridGames: false,
				plainBlind3Label: null,
			})
		);
		expect(result.current.hasBlind3Column).toBe(false);
	});

	it("computes hasBlind3Column true via resolveGroup when a visible game set has a blind3Label", () => {
		const levels: BlindLevelRow[] = [
			row({ id: "a", games: [gameSet({ variants: ["Variant B"] })] }),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, {
				hybridGames: true,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.hasBlind3Column).toBe(true);
	});

	it("computes hasBlind3Column false via resolveGroup when no visible game set has a blind3Label", () => {
		const levels: BlindLevelRow[] = [
			row({ id: "a", games: [gameSet({ variants: ["Variant A"] })] }),
		];
		const { result } = renderHook(() =>
			useBlindStructureTable(levels, {
				hybridGames: true,
				resolveGroup: makeResolveGroup(),
			})
		);
		expect(result.current.hasBlind3Column).toBe(false);
	});
});
