import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MixGroupInfo, ResolveGroup } from "@/shared/lib/mix-games";
import { updateGroup } from "@/shared/lib/mix-games";
import { useLevelPatternsSheet } from "../use-level-patterns-sheet";

const GROUPS: Record<string, MixGroupInfo> = {
	limit: {
		id: "g-limit",
		label: "Limit",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
		sortIndex: 0,
	},
	stud: {
		id: "g-stud",
		label: "Stud",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: "Bring-in",
		sortIndex: 1,
	},
	bigbet: {
		id: "g-bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
		sortIndex: 2,
	},
};

const VARIANT_GROUPS: Record<string, MixGroupInfo> = {
	"NL Hold'em": GROUPS.bigbet,
	"Pot Limit Omaha": GROUPS.bigbet,
	"Limit Hold'em": GROUPS.limit,
	Razz: GROUPS.stud,
};

const resolveGroup: ResolveGroup = (variant) =>
	VARIANT_GROUPS[variant] ?? GROUPS.bigbet;

// Mirrors the wrapper's mapping: a mix master label expands to its
// composition, anything else is a single-game assignment.
const compositionFor = (label: string): string[] =>
	label === "8-Game" ? ["NL Hold'em", "Razz"] : [label];

function setup(args: Partial<Parameters<typeof useLevelPatternsSheet>[0]>) {
	const onSave = vi.fn();
	const rendered = renderHook(
		(props: Partial<Parameters<typeof useLevelPatternsSheet>[0]> = {}) =>
			useLevelPatternsSheet({
				compositionFor,
				games: null,
				lockedLabels: [],
				mode: "assign",
				onSave,
				open: true,
				resolveGroup,
				...args,
				...props,
			}),
		{ initialProps: {} }
	);
	return { ...rendered, onSave };
}

describe("useLevelPatternsSheet — locked mode (tournament-wide mix)", () => {
	it("seeds a blank level from the locked composition", () => {
		const { result } = setup({
			mode: "locked",
			lockedLabels: ["NL Hold'em", "Razz"],
			games: null,
		});
		expect(result.current.rows.map((r) => [r.groupLabel, r.variants])).toEqual([
			["Stud", ["Razz"]],
			["Big Bet", ["NL Hold'em"]],
		]);
		expect(result.current.rows[0].blind1).toBe("");
	});

	it("re-derives stored games to the locked composition, keeping amounts", () => {
		const { result } = setup({
			mode: "locked",
			lockedLabels: ["Limit Hold'em", "NL Hold'em"],
			games: [
				{
					name: "Big Bet",
					variants: ["NL Hold'em", "Pot Limit Omaha"],
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
				},
			],
		});
		expect(result.current.rows.map((r) => [r.groupLabel, r.variants])).toEqual([
			["Limit", ["Limit Hold'em"]],
			["Big Bet", ["NL Hold'em"]],
		]);
		// The surviving Big Bet group keeps its amounts.
		expect(result.current.rows[1].blind1).toBe("100");
		expect(result.current.rows[1].blind2).toBe("200");
	});
});

describe("useLevelPatternsSheet — assign mode (per-level variants)", () => {
	it("keeps stored games as-is on open", () => {
		const { result } = setup({
			games: [
				{
					name: "My Stud",
					variants: ["Razz"],
					blind1: 400,
					blind2: 800,
					blind3: 100,
					ante: null,
				},
			],
		});
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].name).toBe("My Stud");
		expect(result.current.rows[0].blind1).toBe("400");
	});

	it("assigning a plain variant makes a single set named after the variant", () => {
		const { result } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("Razz");
		});
		expect(result.current.assignedVariant).toBe("Razz");
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].groupLabel).toBe("Stud");
		expect(result.current.rows[0].name).toBe("Razz");
		expect(result.current.rows[0].variants).toEqual(["Razz"]);
	});

	it("assigning a mix master expands its composition into multiple sets", () => {
		const { result } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("8-Game");
		});
		expect(result.current.rows.map((r) => [r.groupLabel, r.variants])).toEqual([
			["Stud", ["Razz"]],
			["Big Bet", ["NL Hold'em"]],
		]);
	});

	it("re-assigning keeps amounts of groups that survive", () => {
		const { result } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("NL Hold'em");
		});
		act(() => {
			result.current.setRows(
				updateGroup(result.current.rows, result.current.rows[0].uid, {
					blind1: "100",
					blind2: "200",
				})
			);
		});
		act(() => {
			result.current.onAssignVariant("Pot Limit Omaha");
		});
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].variants).toEqual(["Pot Limit Omaha"]);
		expect(result.current.rows[0].name).toBe("Pot Limit Omaha");
		expect(result.current.rows[0].blind1).toBe("100");
	});

	it("resets the assigned variant when the sheet reopens", () => {
		const { result, rerender } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("Razz");
		});
		rerender({ open: false });
		rerender({ open: true });
		expect(result.current.assignedVariant).toBe("");
	});

	it("handleDone emits the buffered rows as level games", () => {
		const { result, onSave } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("Razz");
		});
		act(() => {
			result.current.setRows(
				updateGroup(result.current.rows, result.current.rows[0].uid, {
					blind1: "400",
					blind2: "800",
				})
			);
		});
		act(() => {
			result.current.handleDone();
		});
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenNthCalledWith(1, [
			{
				name: "Razz",
				variants: ["Razz"],
				blind1: 400,
				blind2: 800,
				blind3: null,
				ante: null,
			},
		]);
	});
});

// Regression: the buffer must not reset from parent re-renders while open.
describe("useLevelPatternsSheet — buffer stability", () => {
	it("keeps edits across re-renders while the sheet stays open", () => {
		const { result, rerender } = setup({ games: null });
		act(() => {
			result.current.onAssignVariant("Razz");
		});
		rerender({});
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].variants).toEqual(["Razz"]);
	});
});
