import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

const gameVariantsMocks = vi.hoisted(() => ({
	variants: [] as Array<{
		blindLabel1: string | null;
		blindLabel2: string | null;
		blindLabel3: string | null;
		id: string;
		name: string;
	}>,
}));

vi.mock("@/features/game-variants/hooks/use-game-variants", () => ({
	useGameVariants: () => ({ variants: gameVariantsMocks.variants }),
}));

import { useTournamentModalContent } from "@/features/rooms/components/tournament-modal-content/use-tournament-modal-content";

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
};

const STUD_VARIANT = {
	id: "v-stud",
	name: "Stud",
	blindLabel1: "Bring-in",
	blindLabel2: null,
	blindLabel3: null,
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

	describe("blindLabels", () => {
		it("falls back to SB/BB/Straddle when initialFormValues is undefined", () => {
			gameVariantsMocks.variants = [];
			const { result } = renderHook(() =>
				useTournamentModalContent({ initialBlindLevels: [] })
			);
			expect(result.current.blindLabels).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: "Straddle",
			});
		});

		it("resolves labels from the user's variant matching the initial variant text", () => {
			gameVariantsMocks.variants = [STUD_VARIANT];
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [],
					initialFormValues: { name: "Main", variant: "stud" },
				})
			);
			expect(result.current.blindLabels).toEqual({
				blind1: "Bring-in",
				blind2: null,
				blind3: null,
			});
		});

		it("falls back to defaults when the initial variant text matches no user variant", () => {
			gameVariantsMocks.variants = [STUD_VARIANT];
			const { result } = renderHook(() =>
				useTournamentModalContent({
					initialBlindLevels: [],
					initialFormValues: { name: "Main", variant: "Unknown" },
				})
			);
			expect(result.current.blindLabels).toEqual({
				blind1: "SB",
				blind2: "BB",
				blind3: "Straddle",
			});
		});
	});
});
