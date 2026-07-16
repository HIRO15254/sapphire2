import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEmptyGamesRow } from "@/features/rooms/hooks/use-empty-games-row";

function setup() {
	const onCreateLevel = vi.fn();
	const { result } = renderHook(() => useEmptyGamesRow({ onCreateLevel }));
	const minutes = document.createElement("input");
	(result.current.minutesRef as { current: HTMLInputElement | null }).current =
		minutes;
	return { result, onCreateLevel, minutes };
}

describe("useEmptyGamesRow", () => {
	it("creates a blank games-mode level with typed minutes and resets the cell", () => {
		const { result, onCreateLevel, minutes } = setup();
		minutes.value = "30";
		result.current.handleAddLevel();
		expect(onCreateLevel).toHaveBeenCalledTimes(1);
		expect(onCreateLevel).toHaveBeenNthCalledWith(1, {
			blind1: null,
			blind2: null,
			ante: null,
			minutes: 30,
			games: null,
		});
		expect(minutes.value).toBe("");
	});

	it("passes minutes=null when the cell is empty", () => {
		const { result, onCreateLevel } = setup();
		result.current.handleAddLevel();
		expect(onCreateLevel).toHaveBeenNthCalledWith(1, {
			blind1: null,
			blind2: null,
			ante: null,
			minutes: null,
			games: null,
		});
	});

	it.each([
		"abc",
		"30.5",
		"30min",
		"-1",
		"Infinity",
	])("does not create a level when minutes %s is invalid", (value) => {
		const { result, onCreateLevel, minutes } = setup();
		minutes.value = value;
		result.current.handleAddLevel();
		expect(onCreateLevel).not.toHaveBeenCalled();
		expect(minutes.value).toBe(value);
	});

	it("still creates when the minutes input is not mounted", () => {
		const onCreateLevel = vi.fn();
		const { result } = renderHook(() => useEmptyGamesRow({ onCreateLevel }));
		result.current.handleAddLevel();
		expect(onCreateLevel).toHaveBeenCalledTimes(1);
		expect(onCreateLevel).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ minutes: null })
		);
	});
});
