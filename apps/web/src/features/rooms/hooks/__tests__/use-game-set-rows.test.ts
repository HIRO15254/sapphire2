import { renderHook } from "@testing-library/react";
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
	const { result } = renderHook(() => useGameSetRows({ row, onUpdate }));
	return { result, onUpdate, row };
}

describe("useGameSetRows", () => {
	it("exposes the level's game sets", () => {
		const { result } = setup();
		expect(result.current.games).toHaveLength(2);
		expect(result.current.games[0].name).toBe("Limit");
	});

	it("blurring a set's field patches only that set", () => {
		const { result, onUpdate } = setup();
		result.current.handleSetFieldBlur(1, "blind1")(blurEvent("150"));
		expect(onUpdate).toHaveBeenCalledTimes(1);
		const [id, patch] = onUpdate.mock.calls[0];
		expect(id).toBe("l1");
		expect(patch.games).toHaveLength(2);
		expect(patch.games?.[0]).toEqual(
			expect.objectContaining({ blind1: 400, blind2: 800 })
		);
		expect(patch.games?.[1]).toEqual(
			expect.objectContaining({ blind1: 150, blind2: 200, ante: 25 })
		);
	});

	it("maps a blank or invalid value to null", () => {
		const { result, onUpdate } = setup();
		result.current.handleSetFieldBlur(0, "ante")(blurEvent("abc"));
		expect(onUpdate).toHaveBeenNthCalledWith(
			1,
			"l1",
			expect.objectContaining({
				games: [
					expect.objectContaining({ name: "Limit", ante: null }),
					expect.objectContaining({ name: "Big Bet" }),
				],
			})
		);
	});

	it("updates blind2 of the first set", () => {
		const { result, onUpdate } = setup();
		result.current.handleSetFieldBlur(0, "blind2")(blurEvent("1000"));
		const patch = onUpdate.mock.calls[0][1];
		expect(patch.games?.[0].blind2).toBe(1000);
		expect(patch.games?.[1].blind2).toBe(200);
	});

	it("blurring minutes patches the level's minutes", () => {
		const { result, onUpdate } = setup();
		result.current.handleMinutesBlur(blurEvent("15"));
		expect(onUpdate).toHaveBeenNthCalledWith(1, "l1", { minutes: 15 });
	});

	it("returns empty games for a level without sets", () => {
		const { result } = setup({ ...makeRow(), games: null });
		expect(result.current.games).toEqual([]);
	});
});
