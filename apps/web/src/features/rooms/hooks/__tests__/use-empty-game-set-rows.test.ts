import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { renderHook } from "@testing-library/react";
import type { FocusEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { useEmptyGameSetRows } from "@/features/rooms/hooks/use-empty-game-set-rows";

const SEEDS: LevelGameGroup[] = [
	{
		name: "Big Bet",
		variants: ["NL Hold'em"],
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
	},
	{
		name: "Stud",
		variants: ["Razz"],
		blind1: null,
		blind2: null,
		blind3: null,
		ante: null,
	},
];

function buildFocusEvent(
	target: HTMLInputElement,
	relatedTarget: EventTarget | null
) {
	return {
		target,
		relatedTarget,
	} as unknown as FocusEvent<HTMLInputElement>;
}

function setup(seeds: LevelGameGroup[] = SEEDS) {
	const onCreateLevel = vi.fn();
	const { result } = renderHook(() =>
		useEmptyGameSetRows({ seeds, onCreateLevel })
	);
	// Register one input per amount cell plus minutes, like the component does.
	const cells = seeds.map((_, index) => {
		const blind1 = document.createElement("input");
		const blind2 = document.createElement("input");
		const ante = document.createElement("input");
		result.current.registerCell(index, "blind1")(blind1);
		result.current.registerCell(index, "blind2")(blind2);
		result.current.registerCell(index, "ante")(ante);
		return { blind1, blind2, ante };
	});
	const minutes = document.createElement("input");
	(result.current.minutesRef as { current: HTMLInputElement | null }).current =
		minutes;
	return { result, onCreateLevel, cells, minutes };
}

describe("useEmptyGameSetRows", () => {
	it("creates a level with the entered set's amounts and blank remaining sets", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].blind1.value = "100";
		cells[0].blind2.value = "200";
		cells[0].ante.value = "25";

		result.current.handleCellBlur(
			0,
			"ante"
		)(buildFocusEvent(cells[0].ante, null));

		expect(onCreateLevel).toHaveBeenCalledTimes(1);
		expect(onCreateLevel).toHaveBeenNthCalledWith(1, {
			blind1: null,
			blind2: null,
			ante: null,
			minutes: null,
			games: [
				{
					name: "Big Bet",
					variants: ["NL Hold'em"],
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: 25,
				},
				{
					name: "Stud",
					variants: ["Razz"],
					blind1: null,
					blind2: null,
					blind3: null,
					ante: null,
				},
			],
		});
	});

	it("auto-fills blind2 (x2) and ante within the same set on blind1 blur", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].blind1.value = "100";

		result.current.handleCellBlur(
			0,
			"blind1"
		)(buildFocusEvent(cells[0].blind1, null));

		const games = onCreateLevel.mock.calls[0][0].games;
		expect(games[0]).toEqual(
			expect.objectContaining({ blind1: 100, blind2: 200, ante: 200 })
		);
		// The other set stays untouched by the auto-fill.
		expect(games[1]).toEqual(
			expect.objectContaining({ blind1: null, blind2: null, ante: null })
		);
	});

	it("does not overwrite an existing blind2 on blind1 blur", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[1].blind1.value = "400";
		cells[1].blind2.value = "800";

		result.current.handleCellBlur(
			1,
			"blind1"
		)(buildFocusEvent(cells[1].blind1, null));

		const games = onCreateLevel.mock.calls[0][0].games;
		expect(games[1]).toEqual(
			expect.objectContaining({ blind1: 400, blind2: 800, ante: 800 })
		);
	});

	it("propagates blind2 to an empty ante on blind2 blur", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].blind1.value = "100";
		cells[0].blind2.value = "250";

		result.current.handleCellBlur(
			0,
			"blind2"
		)(buildFocusEvent(cells[0].blind2, null));

		const games = onCreateLevel.mock.calls[0][0].games;
		expect(games[0]).toEqual(
			expect.objectContaining({ blind1: 100, blind2: 250, ante: 250 })
		);
	});

	it("does not create when no set has blind1 entered", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].ante.value = "25";

		result.current.handleCellBlur(
			0,
			"ante"
		)(buildFocusEvent(cells[0].ante, null));

		expect(onCreateLevel).not.toHaveBeenCalled();
	});

	it("does not create when focus moves to another cell of the block", () => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].blind1.value = "100";

		result.current.handleCellBlur(
			0,
			"blind1"
		)(buildFocusEvent(cells[0].blind1, cells[1].blind1));

		expect(onCreateLevel).not.toHaveBeenCalled();
		// Auto-fill still happened while focus stays inside.
		expect(cells[0].blind2.value).toBe("200");
	});

	it("does not create when focus moves to the minutes cell", () => {
		const { result, onCreateLevel, cells, minutes } = setup();
		cells[0].blind1.value = "100";

		result.current.handleCellBlur(
			0,
			"blind1"
		)(buildFocusEvent(cells[0].blind1, minutes));

		expect(onCreateLevel).not.toHaveBeenCalled();
	});

	it("includes typed minutes and resets every cell after creating", () => {
		const { result, onCreateLevel, cells, minutes } = setup();
		cells[0].blind1.value = "100";
		cells[1].blind1.value = "400";
		minutes.value = "30";

		result.current.handleMinutesBlur(buildFocusEvent(minutes, null));

		expect(onCreateLevel).toHaveBeenCalledTimes(1);
		expect(onCreateLevel.mock.calls[0][0].minutes).toBe(30);
		expect(cells[0].blind1.value).toBe("");
		expect(cells[1].blind1.value).toBe("");
		expect(minutes.value).toBe("");
	});

	it("unregisters a cell when the callback ref receives null", () => {
		const { result, onCreateLevel, cells } = setup();
		result.current.registerCell(1, "blind1")(null);
		cells[0].blind1.value = "100";

		// The unregistered input no longer blocks creation as a relatedTarget.
		result.current.handleCellBlur(
			0,
			"blind1"
		)(buildFocusEvent(cells[0].blind1, cells[1].blind1));

		expect(onCreateLevel).toHaveBeenCalledTimes(1);
	});

	it.each([
		"100.5",
		"100chips",
		"-1",
		"Infinity",
	])("does not create or reset the block when a game amount %s is invalid", (value) => {
		const { result, onCreateLevel, cells } = setup();
		cells[0].blind1.value = value;

		result.current.handleCellBlur(
			0,
			"blind1"
		)(buildFocusEvent(cells[0].blind1, null));

		expect(onCreateLevel).not.toHaveBeenCalled();
		expect(cells[0].blind1.value).toBe(value);
	});

	it("does not create when minutes are invalid", () => {
		const { result, onCreateLevel, cells, minutes } = setup();
		cells[0].blind1.value = "100";
		minutes.value = "20min";

		result.current.handleMinutesBlur(buildFocusEvent(minutes, null));

		expect(onCreateLevel).not.toHaveBeenCalled();
		expect(cells[0].blind1.value).toBe("100");
	});
});
