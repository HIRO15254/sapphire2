import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStackRecordEditor } from "@/features/live-sessions/components/stack-record-editor/use-stack-record-editor";

const MUST_BE_AFTER = /Must be after/;

describe("useStackRecordEditor", () => {
	it("seeds initialPayload values (stackAmount and allIns with generated ids)", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialPayload: {
					stackAmount: 1000,
					allIns: [
						{ potSize: 100, trials: 1, equity: 50, wins: 1 },
						{ potSize: 200, trials: 2, equity: 40, wins: 1 },
					],
				},
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.stackAmount).toBe("1000");
		expect(result.current.allIns).toHaveLength(2);
		expect(result.current.allIns[0].id).toBe(1);
		expect(result.current.allIns[1].id).toBe(2);
	});

	it("handles empty allIns list in payload", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialPayload: { stackAmount: 500, allIns: [] },
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.allIns).toEqual([]);
	});

	it("adds a new all-in via handleAllInSubmit when not editing", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialPayload: { stackAmount: 500, allIns: [] },
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.handleAllInSubmit({
				potSize: 800,
				trials: 1,
				equity: 50,
				wins: 0,
			});
		});
		expect(result.current.allIns).toHaveLength(1);
		expect(result.current.allIns[0]).toMatchObject({
			potSize: 800,
			trials: 1,
			equity: 50,
			wins: 0,
		});
		expect(result.current.allInSheetOpen).toBe(false);
		expect(result.current.editingAllIn).toBeNull();
	});

	it("updates an existing all-in in place when editingAllIn is set", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialPayload: {
					stackAmount: 500,
					allIns: [{ potSize: 100, trials: 1, equity: 50, wins: 1 }],
				},
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.setEditingAllIn(result.current.allIns[0]);
		});
		act(() => {
			result.current.handleAllInSubmit({
				potSize: 250,
				trials: 2,
				equity: 30,
				wins: 0,
			});
		});
		expect(result.current.allIns).toHaveLength(1);
		expect(result.current.allIns[0]).toMatchObject({
			potSize: 250,
			trials: 2,
			equity: 30,
			wins: 0,
			id: 1,
		});
	});

	it("handleAllInDelete removes the editing all-in and closes the sheet", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialPayload: {
					stackAmount: 500,
					allIns: [
						{ potSize: 100, trials: 1, equity: 50, wins: 1 },
						{ potSize: 200, trials: 2, equity: 40, wins: 1 },
					],
				},
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.setEditingAllIn(result.current.allIns[0]);
		});
		act(() => {
			result.current.handleAllInDelete();
		});
		expect(result.current.allIns).toHaveLength(1);
		expect(result.current.allIns[0].id).toBe(2);
		expect(result.current.allInSheetOpen).toBe(false);
		expect(result.current.editingAllIn).toBeNull();
	});

	it("handleSave calls onSubmit with the numeric payload and computed occurredAt", () => {
		const onSubmit = vi.fn();
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialOccurredAt: "2026-04-10T12:00:00",
				initialPayload: {
					stackAmount: 500,
					allIns: [{ potSize: 100, trials: 1, equity: 50, wins: 1 }],
				},
				onSubmit,
			})
		);
		act(() => {
			result.current.setStackAmount("900");
			result.current.setTime("13:30");
		});
		act(() => {
			result.current.handleSave();
		});
		expect(onSubmit).toHaveBeenCalledTimes(1);
		const [payload, ts] = onSubmit.mock.calls[0];
		expect(payload).toEqual({
			stackAmount: 900,
			allIns: [{ potSize: 100, trials: 1, equity: 50, wins: 1 }],
		});
		expect(typeof ts).toBe("number");
	});

	it("timeError reflects validateOccurredAtTime when outside the allowed window", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialOccurredAt: "2026-04-10T12:00:00",
				initialPayload: { stackAmount: 500, allIns: [] },
				maxTime: new Date("2026-04-10T13:00:00"),
				minTime: new Date("2026-04-10T11:00:00"),
				onSubmit: vi.fn(),
			})
		);
		act(() => {
			result.current.setTime("10:00");
		});
		expect(result.current.timeError).toMatch(MUST_BE_AFTER);
	});

	it("timeError is null when initial values produce a valid time", () => {
		const { result } = renderHook(() =>
			useStackRecordEditor({
				initialOccurredAt: "2026-04-10T12:00:00",
				initialPayload: { stackAmount: 500, allIns: [] },
				onSubmit: vi.fn(),
			})
		);
		expect(result.current.timeError).toBeNull();
	});
});
