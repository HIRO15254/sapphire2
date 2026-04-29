import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useLocalBlindStructure } from "@/features/stores/components/blind-level-editor/use-blind-level-editor";
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

describe("useLocalBlindStructure", () => {
	it("exposes sensors and handler callbacks", () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: [], onChange })
		);
		expect(result.current.sensors).toBeDefined();
		expect(typeof result.current.handleAddLevel).toBe("function");
		expect(typeof result.current.handleAddBreak).toBe("function");
		expect(typeof result.current.handleDelete).toBe("function");
		expect(typeof result.current.handleUpdate).toBe("function");
		expect(typeof result.current.handleCreateLevel).toBe("function");
		expect(typeof result.current.handleDragEnd).toBe("function");
	});

	it("handleAddLevel appends a non-break level", () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: [], onChange })
		);
		act(() => {
			result.current.handleAddLevel();
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		const next = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(next).toHaveLength(1);
		expect(next[0].isBreak).toBe(false);
	});

	it("handleAddBreak appends a break level", () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: [], onChange })
		);
		act(() => {
			result.current.handleAddBreak();
		});
		const next = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(next[0].isBreak).toBe(true);
	});

	it("handleDelete removes the matching row and relevels the rest", () => {
		const onChange = vi.fn();
		const rows: BlindLevelRow[] = [
			row({ id: "a", level: 1 }),
			row({ id: "b", level: 2 }),
		];
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: rows, onChange })
		);
		act(() => {
			result.current.handleDelete("a");
		});
		const next = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(next).toHaveLength(1);
		expect(next[0].level).toBe(1);
		expect(next[0].id).toBe("b");
	});

	it("handleUpdate applies partial updates; updates minutes state when minutes provided", () => {
		const onChange = vi.fn();
		const rows: BlindLevelRow[] = [row({ id: "a", level: 1 })];
		const { result, rerender } = renderHook(
			({ value }: { value: BlindLevelRow[] }) =>
				useLocalBlindStructure({ value, onChange }),
			{ initialProps: { value: rows } }
		);
		act(() => {
			result.current.handleUpdate("a", { minutes: 25 });
		});
		const updated = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(updated[0].minutes).toBe(25);
		// Next addLevel should reuse the remembered minutes
		rerender({ value: updated });
		act(() => {
			result.current.handleAddLevel();
		});
		const appended = onChange.mock.calls[1][0] as BlindLevelRow[];
		expect(appended[1].minutes).toBe(25);
	});

	it("handleCreateLevel appends with the provided values and reuses effectiveLastMinutes when minutes is null", () => {
		const onChange = vi.fn();
		const rows: BlindLevelRow[] = [row({ id: "a", level: 1, minutes: 20 })];
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: rows, onChange })
		);
		act(() => {
			result.current.handleCreateLevel({
				ante: 10,
				blind1: 100,
				blind2: 200,
				minutes: null,
			});
		});
		const next = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(next).toHaveLength(2);
		expect(next[1].ante).toBe(10);
		expect(next[1].blind1).toBe(100);
		expect(next[1].blind2).toBe(200);
		expect(next[1].minutes).toBe(20);
	});

	it("handleDragEnd: calls onChange only when the drag produced a reorder", () => {
		const onChange = vi.fn();
		const rows: BlindLevelRow[] = [
			row({ id: "a", level: 1 }),
			row({ id: "b", level: 2 }),
		];
		const { result } = renderHook(() =>
			useLocalBlindStructure({ value: rows, onChange })
		);
		act(() => {
			result.current.handleDragEnd({
				active: { id: "a" },
				over: { id: "a" },
			} as Parameters<typeof result.current.handleDragEnd>[0]);
		});
		expect(onChange).not.toHaveBeenCalled();
		act(() => {
			result.current.handleDragEnd({
				active: { id: "a" },
				over: { id: "b" },
			} as Parameters<typeof result.current.handleDragEnd>[0]);
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		const reordered = onChange.mock.calls[0][0] as BlindLevelRow[];
		expect(reordered[0].id).toBe("b");
		expect(reordered[1].id).toBe("a");
	});
});
