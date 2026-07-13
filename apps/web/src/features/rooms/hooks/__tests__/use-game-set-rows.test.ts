import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useGameSetRows } from "../use-game-set-rows";

function makeRow(): BlindLevelRow {
	return {
		id: "l1",
		tournamentId: "t1",
		level: 3,
		isBreak: false,
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
		minutes: 20,
		games: [
			{
				name: "Limit",
				variants: ["Limit Hold'em"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: null,
			},
			{
				name: "Big Bet",
				variants: ["NL Hold'em"],
				blind1: 100,
				blind2: 200,
				blind3: null,
				ante: 25,
			},
		],
	};
}

function blurEvent(value: string) {
	return {
		target: { value },
	} as React.FocusEvent<HTMLInputElement>;
}

function setup(row: BlindLevelRow = makeRow()) {
	const onUpdate = vi.fn();
	const onUpdateGameSet = vi.fn();
	const { result, rerender } = renderHook(
		(props: { row: BlindLevelRow }) =>
			useGameSetRows({ row: props.row, onUpdate, onUpdateGameSet }),
		{ initialProps: { row } }
	);
	return { result, rerender, onUpdate, onUpdateGameSet, row };
}

describe("useGameSetRows", () => {
	it("exposes the level's game sets", () => {
		const { result } = setup();
		expect(result.current.games).toHaveLength(2);
		expect(result.current.games[0].name).toBe("Limit");
	});

	it("blurring a changed cell emits a set-cell patch for that cell only", () => {
		const { result, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleSetFieldBlur(1, "blind1")(blurEvent("150"));
		});
		expect(onUpdateGameSet).toHaveBeenCalledTimes(1);
		expect(onUpdateGameSet).toHaveBeenNthCalledWith(1, "l1", {
			index: 1,
			field: "blind1",
			value: 150,
		});
	});

	it("maps an invalid value to null when the cell had a value", () => {
		const { result, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleSetFieldBlur(0, "blind1")(blurEvent("abc"));
		});
		expect(onUpdateGameSet).toHaveBeenCalledTimes(1);
		expect(onUpdateGameSet).toHaveBeenNthCalledWith(1, "l1", {
			index: 0,
			field: "blind1",
			value: null,
		});
	});

	it("does not emit when the blurred value equals the stored value", () => {
		const { result, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleSetFieldBlur(0, "blind1")(blurEvent("400"));
		});
		expect(onUpdateGameSet).not.toHaveBeenCalled();
	});

	it("treats a blank blur on a null field as unchanged (null == null)", () => {
		const { result, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleSetFieldBlur(0, "ante")(blurEvent(""));
		});
		expect(onUpdateGameSet).not.toHaveBeenCalled();
	});

	it("emits null when clearing a cell that had a value", () => {
		const { result, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleSetFieldBlur(1, "ante")(blurEvent(""));
		});
		expect(onUpdateGameSet).toHaveBeenCalledTimes(1);
		expect(onUpdateGameSet).toHaveBeenNthCalledWith(1, "l1", {
			index: 1,
			field: "ante",
			value: null,
		});
	});

	it("blurring minutes patches the level's minutes via onUpdate", () => {
		const { result, onUpdate, onUpdateGameSet } = setup();
		act(() => {
			result.current.handleMinutesBlur(blurEvent("15"));
		});
		expect(onUpdate).toHaveBeenNthCalledWith(1, "l1", { minutes: 15 });
		expect(onUpdateGameSet).not.toHaveBeenCalled();
	});

	it("returns empty games for a level without sets", () => {
		const { result } = setup({ ...makeRow(), games: null });
		expect(result.current.games).toEqual([]);
	});

	describe("focused-cell input keys", () => {
		it("builds unfocused keys from row id, set identity, field, and value", () => {
			const { result } = setup();
			expect(result.current.setFieldKey(0, "blind1")).toBe(
				"l1-Limit Hold'em-blind1-400"
			);
			expect(result.current.setFieldKey(1, "ante")).toBe(
				"l1-NL Hold'em-ante-25"
			);
		});

		it("uses an empty value segment for null cells", () => {
			const { result } = setup();
			expect(result.current.setFieldKey(0, "ante")).toBe(
				"l1-Limit Hold'em-ante-"
			);
		});

		it("keeps the focused cell's key stable across external value changes", () => {
			const { result, rerender, row } = setup();
			const before = result.current.setFieldKey(0, "blind1");
			act(() => {
				result.current.handleSetFieldFocus(0, "blind1")();
			});
			// Focusing alone must not remount the input.
			expect(result.current.setFieldKey(0, "blind1")).toBe(before);
			// An external cache change (refetch) lands mid-typing.
			const games = row.games ?? [];
			rerender({
				row: { ...row, games: [{ ...games[0], blind1: 999 }, games[1]] },
			});
			expect(result.current.setFieldKey(0, "blind1")).toBe(before);
		});

		it("remounts unfocused cells on external value changes", () => {
			const { result, rerender, row } = setup();
			act(() => {
				result.current.handleSetFieldFocus(0, "blind1")();
			});
			const games = row.games ?? [];
			rerender({
				row: {
					...row,
					games: [{ ...games[0], blind2: 1600 }, games[1]],
				},
			});
			expect(result.current.setFieldKey(0, "blind2")).toBe(
				"l1-Limit Hold'em-blind2-1600"
			);
		});

		it("reflects the latest value in the key after blur", () => {
			const { result, rerender, row } = setup();
			act(() => {
				result.current.handleSetFieldFocus(0, "blind1")();
			});
			act(() => {
				result.current.handleSetFieldBlur(0, "blind1")(blurEvent("500"));
			});
			const games = row.games ?? [];
			rerender({
				row: { ...row, games: [{ ...games[0], blind1: 500 }, games[1]] },
			});
			expect(result.current.setFieldKey(0, "blind1")).toBe(
				"l1-Limit Hold'em-blind1-500"
			);
		});

		it("clears the focused cell on blur even when the value is unchanged", () => {
			const { result, rerender, row } = setup();
			act(() => {
				result.current.handleSetFieldFocus(0, "blind1")();
			});
			act(() => {
				result.current.handleSetFieldBlur(0, "blind1")(blurEvent("400"));
			});
			const games = row.games ?? [];
			rerender({
				row: { ...row, games: [{ ...games[0], blind1: 777 }, games[1]] },
			});
			expect(result.current.setFieldKey(0, "blind1")).toBe(
				"l1-Limit Hold'em-blind1-777"
			);
		});
	});
});
