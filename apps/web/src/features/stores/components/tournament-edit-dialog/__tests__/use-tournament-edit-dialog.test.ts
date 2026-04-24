import type { ExtractedTournamentData } from "@sapphire2/api/routers/ai-extract";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTournamentEditDialog } from "@/features/stores/components/tournament-edit-dialog/use-tournament-edit-dialog";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";

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

describe("useTournamentEditDialog", () => {
	it("exposes initial values when open but no AI extraction has happened", () => {
		const initialBlindLevels: BlindLevelRow[] = [row({ level: 1 })];
		const initialFormValues = { name: "Main", variant: "nlh" };
		const { result } = renderHook(() =>
			useTournamentEditDialog({
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
			useTournamentEditDialog({
				initialBlindLevels: [],
				open: true,
				resetKey: "my-reset",
			})
		);
		expect(result.current.contentKey).toBe("my-reset-0");
	});

	it("handleAiExtracted in create mode: replaces form values from scratch and bumps aiKey", () => {
		const { result } = renderHook(() =>
			useTournamentEditDialog({
				aiMode: "create",
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
			chipPurchases: [],
			variant: "nlh",
		});
		expect(result.current.effectiveLevels).toHaveLength(1);
		expect(result.current.effectiveLevels[0].minutes).toBe(20);
	});

	it("handleAiExtracted in edit mode: merges extracted over base, falls back to initial levels when empty", () => {
		const initialBlindLevels: BlindLevelRow[] = [
			row({ id: "l1", level: 1, minutes: 15 }),
		];
		const { result } = renderHook(() =>
			useTournamentEditDialog({
				aiMode: "edit",
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

	it("closes AI sheet and resets effective values when open goes from true to false", () => {
		const { result, rerender } = renderHook(
			({ open }: { open: boolean }) =>
				useTournamentEditDialog({
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
			useTournamentEditDialog({ initialBlindLevels: [], open: true })
		);
		act(() => {
			result.current.setAiSheetOpen(true);
		});
		expect(result.current.aiSheetOpen).toBe(true);
	});
});
