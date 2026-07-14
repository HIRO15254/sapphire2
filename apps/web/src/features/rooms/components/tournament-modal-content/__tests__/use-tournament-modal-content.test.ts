import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The hook only needs isMixValue; recognize the per-level sentinel and one
// mix master label like the real master-data resolver does.
vi.mock("@/shared/hooks/use-game-groups", () => ({
	useGameGroups: () => ({
		isMixValue: (value: string) =>
			["mix", "8-game", "horse"].includes(value.trim().toLowerCase()),
	}),
}));

import { useTournamentModalContent } from "@/features/rooms/components/tournament-modal-content/use-tournament-modal-content";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

const ROW: BlindLevelRow = {
	id: "a",
	tournamentId: "",
	level: 1,
	isBreak: false,
	blind1: 1,
	blind2: 2,
	blind3: null,
	ante: null,
	minutes: 20,
	games: null,
};

const GAME_SET_ROW: BlindLevelRow = {
	...ROW,
	id: "b",
	blind1: null,
	blind2: null,
	games: [
		{
			name: null,
			variants: ["Razz"],
			blind1: 400,
			blind2: 800,
			blind3: null,
			ante: null,
		},
	],
};

describe("useTournamentModalContent", () => {
	it("initializes localBlindLevels from the provided initialBlindLevels", () => {
		const { result } = renderHook(() =>
			useTournamentModalContent({ initialBlindLevels: [ROW] })
		);
		expect(result.current.localBlindLevels).toEqual([ROW]);
	});

	it("starts with empty array when initialBlindLevels is empty", () => {
		const { result } = renderHook(() =>
			useTournamentModalContent({ initialBlindLevels: [] })
		);
		expect(result.current.localBlindLevels).toEqual([]);
	});

	it("setLocalBlindLevels replaces the current list", () => {
		const { result } = renderHook(() =>
			useTournamentModalContent({ initialBlindLevels: [] })
		);
		act(() => {
			result.current.setLocalBlindLevels([ROW]);
		});
		expect(result.current.localBlindLevels).toEqual([ROW]);
	});

	it("defaults activeTab to details", () => {
		const { result } = renderHook(() =>
			useTournamentModalContent({ initialBlindLevels: [] })
		);
		expect(result.current.activeTab).toBe("details");
	});

	it("setActiveTab switches the active tab", () => {
		const { result } = renderHook(() =>
			useTournamentModalContent({ initialBlindLevels: [] })
		);
		act(() => {
			result.current.setActiveTab("structure");
		});
		expect(result.current.activeTab).toBe("structure");
	});

	describe("handleStructureVariantChange", () => {
		it("updates structureVariant", () => {
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [],
					initialVariant: "8-Game",
				})
			);
			act(() => {
				result.current.handleStructureVariantChange("NL Hold'em");
			});
			expect(result.current.structureVariant).toBe("NL Hold'em");
		});

		it("switching mix -> plain strips games from all local levels", () => {
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [ROW, GAME_SET_ROW],
					initialVariant: "8-Game",
				})
			);
			act(() => {
				result.current.handleStructureVariantChange("NL Hold'em");
			});
			expect(result.current.localBlindLevels).toEqual([
				ROW,
				{ ...GAME_SET_ROW, games: null },
			]);
		});

		it("plain -> plain is a no-op on levels without games", () => {
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [ROW],
					initialVariant: "NL Hold'em",
				})
			);
			const before = result.current.localBlindLevels;
			act(() => {
				result.current.handleStructureVariantChange("PL Omaha");
			});
			expect(result.current.localBlindLevels).toBe(before);
		});

		it("switching mix -> mix preserves stored per-level games", () => {
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [GAME_SET_ROW],
					initialVariant: "8-Game",
				})
			);
			act(() => {
				result.current.handleStructureVariantChange("HORSE");
			});
			expect(result.current.localBlindLevels).toEqual([GAME_SET_ROW]);
		});

		it("switching mix -> the per-level sentinel preserves stored per-level games", () => {
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [GAME_SET_ROW],
					initialVariant: "8-Game",
				})
			);
			act(() => {
				result.current.handleStructureVariantChange("mix");
			});
			expect(result.current.localBlindLevels).toEqual([GAME_SET_ROW]);
		});
	});
});
