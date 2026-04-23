import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTournamentStackRecordEditor } from "@/features/live-sessions/components/tournament-stack-record-editor/use-tournament-stack-record-editor";

const MUST_BE_AFTER = /Must be after/;

const PAYLOAD = {
	stackAmount: 15_000,
	remainingPlayers: 20,
	totalEntries: 100,
	chipPurchases: [
		{ name: "Rebuy", cost: 10, chips: 5000 },
		{ name: "Addon", cost: 20, chips: 8000 },
	],
	chipPurchaseCounts: [{ name: "Rebuy", count: 2, chipsPerUnit: 5000 }],
};

describe("useTournamentStackRecordEditor", () => {
	it("seeds all stateful values from the initialPayload", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.stackAmount).toBe("15000");
		expect(result.current.remainingPlayers).toBe("20");
		expect(result.current.totalEntries).toBe("100");
		expect(result.current.chipPurchases).toEqual(PAYLOAD.chipPurchases);
	});

	it("stores '' for null remainingPlayers/totalEntries", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: {
					...PAYLOAD,
					remainingPlayers: null,
					totalEntries: null,
				},
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.remainingPlayers).toBe("");
		expect(result.current.totalEntries).toBe("");
	});

	it("openAddSheet clears editingPurchase and opens the sheet", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.openAddSheet();
		});
		expect(result.current.sheetOpen).toBe(true);
		expect(result.current.editingPurchase).toBeNull();
	});

	it("openEditSheet seeds editingPurchase from the targeted row", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.openEditSheet(1);
		});
		expect(result.current.sheetOpen).toBe(true);
		expect(result.current.editingPurchase).toEqual({
			index: 1,
			name: "Addon",
			cost: 20,
			chips: 8000,
		});
	});

	it("openEditSheet is a no-op when the index is out of range", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.openEditSheet(999);
		});
		expect(result.current.sheetOpen).toBe(false);
	});

	it("handleSheetSubmit appends a new purchase when not editing", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: { ...PAYLOAD, chipPurchases: [] },
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.handleSheetSubmit({ name: "A", cost: 1, chips: 100 });
		});
		expect(result.current.chipPurchases).toEqual([
			{ name: "A", cost: 1, chips: 100 },
		]);
		expect(result.current.sheetOpen).toBe(false);
	});

	it("handleSheetSubmit replaces the targeted row when editingPurchase is set", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.openEditSheet(0);
		});
		act(() => {
			result.current.handleSheetSubmit({ name: "R2", cost: 15, chips: 6000 });
		});
		expect(result.current.chipPurchases[0]).toEqual({
			name: "R2",
			cost: 15,
			chips: 6000,
		});
	});

	it("handleSheetDelete removes the editing row and closes the sheet", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.openEditSheet(0);
		});
		act(() => {
			result.current.handleSheetDelete();
		});
		expect(result.current.chipPurchases).toHaveLength(1);
		expect(result.current.chipPurchases[0].name).toBe("Addon");
		expect(result.current.sheetOpen).toBe(false);
	});

	it("handleRemove drops the row at the index", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.handleRemove(1);
		});
		expect(result.current.chipPurchases).toHaveLength(1);
		expect(result.current.chipPurchases[0].name).toBe("Rebuy");
	});

	it("handleSave forwards a numeric payload (nulls when blank) and occurredAt timestamp", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialOccurredAt: "2026-04-10T12:00:00",
				initialPayload: {
					...PAYLOAD,
					remainingPlayers: null,
					totalEntries: null,
				},
				onSubmit,
			})
		);
		act(() => {
			result.current.setStackAmount("25000");
			result.current.setTime("13:30");
		});
		act(() => {
			result.current.handleSave();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		const [payload, ts] = onSubmit.mock.calls[0];
		expect(payload).toMatchObject({
			stackAmount: 25_000,
			remainingPlayers: null,
			totalEntries: null,
			chipPurchaseCounts: PAYLOAD.chipPurchaseCounts,
			chipPurchases: PAYLOAD.chipPurchases,
		});
		expect(typeof ts).toBe("number");
	});

	it("handleSave propagates parsed numeric remainingPlayers/totalEntries when populated", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialPayload: PAYLOAD,
				onSubmit,
			})
		);
		act(() => {
			result.current.setRemainingPlayers("10");
			result.current.setTotalEntries("80");
		});
		act(() => {
			result.current.handleSave();
		});
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ remainingPlayers: 10, totalEntries: 80 }),
			undefined
		);
	});

	it("timeError surfaces validateOccurredAtTime result when outside window", () => {
		const { result } = renderHook(() =>
			useTournamentStackRecordEditor({
				initialOccurredAt: "2026-04-10T12:00:00",
				initialPayload: PAYLOAD,
				minTime: new Date("2026-04-10T11:00:00"),
				maxTime: new Date("2026-04-10T13:00:00"),
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.setTime("10:00");
		});
		expect(result.current.timeError).toMatch(MUST_BE_AFTER);
	});
});
