import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTournamentFormSheet } from "@/features/rooms/components/tournament-form-sheet/use-tournament-form-sheet";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

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
		...partial,
	};
}

describe("useTournamentFormSheet", () => {
	it("exposes initial values when open but no AI extraction has happened", () => {
		const initialBlindLevels: BlindLevelRow[] = [row({ level: 1 })];
		const initialFormValues = { name: "Main", variant: "nlh" };
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels,
				initialFormValues,
				open: true,
			})
		);
		expect(result.current.effectiveFormValues).toBe(initialFormValues);
		expect(result.current.effectiveLevels).toBe(initialBlindLevels);
		expect(result.current.aiSheetOpen).toBe(false);
		expect(result.current.aiKey).toBe(0);
		expect(result.current.contentKey).toBe("tournament-0");
	});

	it("honors resetKey in contentKey", () => {
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels: [],
				open: true,
				resetKey: "my-reset",
			})
		);
		expect(result.current.contentKey).toBe("my-reset-0");
	});

	it("handleAiExtracted merges extracted data over initial values and bumps aiKey", () => {
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels: [],
				open: true,
			})
		);
		const extracted: ExtractedTournamentData = {
			name: "AI Event",
			buyIn: 50,
			entryFee: 5,
			startingStack: 10_000,
			tableSize: 9,
			chipPurchases: [],
			blindLevels: [
				{
					blind1: 25,
					blind2: 50,
					blind3: null,
					ante: null,
					minutes: 20,
					isBreak: false,
				},
			],
		};
		act(() => {
			result.current.handleAiExtracted(extracted);
		});
		expect(result.current.aiKey).toBe(1);
		expect(result.current.effectiveFormValues).toEqual({
			name: "AI Event",
			buyIn: 50,
			entryFee: 5,
			startingStack: 10_000,
			tableSize: 9,
			variant: "nlh",
		});
		expect(result.current.effectiveLevels).toHaveLength(1);
		expect(result.current.effectiveLevels[0].minutes).toBe(20);
	});

	it("handleAiExtracted merges extracted over base, falls back to initial levels when empty", () => {
		const initialBlindLevels: BlindLevelRow[] = [
			row({ id: "l1", level: 1, minutes: 15 }),
		];
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels,
				initialFormValues: { name: "Orig", variant: "nlh", buyIn: 10 },
				open: true,
			})
		);
		const extracted: ExtractedTournamentData = {
			name: "",
			buyIn: undefined,
			startingStack: 5000,
			blindLevels: [],
			chipPurchases: [],
		};
		act(() => {
			result.current.handleAiExtracted(extracted);
		});
		expect(result.current.effectiveFormValues).toMatchObject({
			name: "Orig",
			startingStack: 5000,
			buyIn: 10,
		});
		// blindLevels extracted is empty -> falls back to initial
		expect(result.current.effectiveLevels[0].id).toBe("l1");
	});

	it("merges over the registered live form values, not just the initial values", () => {
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels: [],
				initialFormValues: { name: "Initial", variant: "nlh" },
				open: true,
			})
		);
		// Simulate the form reporting the values the user has typed in-session.
		act(() => {
			result.current.registerLiveValues(() => ({
				name: "User Typed",
				variant: "plo",
				buyIn: 200,
			}));
		});
		const extracted: ExtractedTournamentData = {
			name: "",
			buyIn: undefined,
			startingStack: 8000,
			blindLevels: [],
			chipPurchases: [],
		};
		act(() => {
			result.current.handleAiExtracted(extracted);
		});
		// Blank AI name/buyIn must not wipe the user's in-session input.
		expect(result.current.effectiveFormValues).toMatchObject({
			name: "User Typed",
			variant: "plo",
			buyIn: 200,
			startingStack: 8000,
		});
	});

	it("falls back to initial values when no live getter is registered", () => {
		const { result } = renderHook(() =>
			useTournamentFormSheet({
				initialBlindLevels: [],
				initialFormValues: { name: "Initial", variant: "nlh", buyIn: 30 },
				open: true,
			})
		);
		act(() => {
			result.current.handleAiExtracted({
				name: "",
				blindLevels: [],
				chipPurchases: [],
			});
		});
		expect(result.current.effectiveFormValues).toMatchObject({
			name: "Initial",
			buyIn: 30,
		});
	});

	it("closes AI sheet and resets effective values when open goes from true to false", () => {
		const { result, rerender } = renderHook(
			({ open }: { open: boolean }) =>
				useTournamentFormSheet({
					initialBlindLevels: [],
					initialFormValues: { name: "x", variant: "nlh" },
					open,
				}),
			{ initialProps: { open: true } }
		);
		act(() => {
			result.current.setAiSheetOpen(true);
		});
		act(() => {
			result.current.handleAiExtracted({
				name: "AI",
				chipPurchases: [],
				blindLevels: [],
			});
		});
		rerender({ open: false });
		expect(result.current.aiSheetOpen).toBe(false);
		expect(result.current.aiKey).toBe(0);
	});

	it("setAiSheetOpen toggles the ai sheet", () => {
		const { result } = renderHook(() =>
			useTournamentFormSheet({ initialBlindLevels: [], open: true })
		);
		act(() => {
			result.current.setAiSheetOpen(true);
		});
		expect(result.current.aiSheetOpen).toBe(true);
	});
});
