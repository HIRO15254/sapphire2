import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTournamentModalContent } from "@/features/stores/components/tournament-modal-content/use-tournament-modal-content";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";

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
});
