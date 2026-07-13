import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	type MixGameGroupRow,
	type MixGroupInfo,
	type ResolveGroup,
	rowsFromVariantLabels,
	updateGroup,
} from "@/shared/lib/mix-games";
import {
	type MixMasterRow,
	useMixMasterEditing,
} from "../use-mix-master-editing";

const BIGBET: MixGroupInfo = {
	id: "g-bigbet",
	label: "Big Bet",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 0,
};

const STUD: MixGroupInfo = {
	id: "g-stud",
	label: "Stud",
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: "Bring-in",
	sortIndex: 1,
};

const GROUP_BY_VARIANT: Record<string, MixGroupInfo> = {
	"NL Hold'em": BIGBET,
	"PL Omaha": BIGBET,
	Razz: STUD,
	"Brand New Game": STUD,
};

const groupFor: ResolveGroup = (label) => GROUP_BY_VARIANT[label] ?? BIGBET;

const MIXES: MixMasterRow[] = [
	{
		id: "m-8game",
		builtinKey: "8-game",
		label: "8-Game",
		games: ["v-nlh", "v-plo"],
	},
	{ id: "m-horse", builtinKey: "horse", label: "HORSE", games: ["v-nlh"] },
];

const VARIANTS = [
	{ id: "v-nlh", label: "NL Hold'em" },
	{ id: "v-plo", label: "PL Omaha" },
	{ id: "v-razz", label: "Razz" },
];

// State harness standing in for either consumer: the ring-game form keeps
// rows in its tanstack form store, the session wizard in useState — the
// hook only sees getRows/setRows either way.
function setup(initialLabels: string[] = ["NL Hold'em", "PL Omaha"]) {
	const onVariantLabelChange = vi.fn();
	const { result } = renderHook(() => {
		const [rows, setRows] = useState<MixGameGroupRow[]>(() =>
			rowsFromVariantLabels(initialLabels, groupFor)
		);
		const editing = useMixMasterEditing({
			getRows: () => rows,
			groupFor,
			mixes: MIXES,
			onVariantLabelChange,
			setRows,
			variants: VARIANTS,
		});
		return { ...editing, rows, setRows };
	});
	return { result, onVariantLabelChange };
}

describe("useMixMasterEditing — mixRowFor", () => {
	it("resolves the master row backing a mix label, case-insensitively", () => {
		const { result } = setup();
		expect(result.current.mixRowFor("8-Game")?.id).toBe("m-8game");
		expect(result.current.mixRowFor("8-game")?.id).toBe("m-8game");
		expect(result.current.mixRowFor(" HORSE ")?.id).toBe("m-horse");
	});

	it("returns null for plain variants and the legacy 'mix' key", () => {
		const { result } = setup();
		expect(result.current.mixRowFor("mix")).toBeNull();
		expect(result.current.mixRowFor("NL Hold'em")).toBeNull();
		expect(result.current.mixRowFor("")).toBeNull();
	});
});

describe("useMixMasterEditing — onEditMix", () => {
	it("opens the sheet with the master row for the current variant", () => {
		const { result } = setup();
		act(() => {
			result.current.onEditMix("8-Game");
		});
		expect(result.current.isMixSheetOpen).toBe(true);
		expect(result.current.editingMix?.id).toBe("m-8game");
	});

	it("ignores edit requests for values without a mix master", () => {
		const { result } = setup();
		act(() => {
			result.current.onEditMix("mix");
		});
		expect(result.current.isMixSheetOpen).toBe(false);
		expect(result.current.editingMix).toBeNull();
	});

	it("setIsMixSheetOpen closes the sheet without touching the rows", () => {
		const { result } = setup();
		act(() => {
			result.current.onEditMix("8-Game");
		});
		const rows = result.current.rows;
		act(() => {
			result.current.setIsMixSheetOpen(false);
		});
		expect(result.current.isMixSheetOpen).toBe(false);
		expect(result.current.rows).toBe(rows);
	});
});

describe("useMixMasterEditing — onMixSaved", () => {
	it("applies the saved label, reseeds keeping surviving amounts, and closes", () => {
		const { result, onVariantLabelChange } = setup();
		act(() => {
			result.current.setRows(
				updateGroup(result.current.rows, result.current.rows[0].uid, {
					blind1: "100",
					blind2: "200",
				})
			);
			result.current.onEditMix("8-Game");
		});
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game Deluxe",
				games: ["v-nlh"],
			});
		});
		expect(onVariantLabelChange).toHaveBeenCalledTimes(1);
		expect(onVariantLabelChange).toHaveBeenNthCalledWith(1, "8-Game Deluxe");
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].variants).toEqual(["NL Hold'em"]);
		expect(result.current.rows[0].blind1).toBe("100");
		expect(result.current.rows[0].blind2).toBe("200");
		expect(result.current.isMixSheetOpen).toBe(false);
	});

	it("without gameLabels, ids missing from the variants list are skipped", () => {
		const { result } = setup();
		act(() => {
			result.current.onMixSaved({
				id: "m-8game",
				label: "8-Game",
				games: ["v-nlh", "v-deleted"],
			});
		});
		expect(result.current.rows).toHaveLength(1);
		expect(result.current.rows[0].variants).toEqual(["NL Hold'em"]);
	});

	it("prefers the sheet's gameLabels so a variant id missing from the list keeps its game (c19)", () => {
		const { result } = setup();
		act(() => {
			result.current.onMixSaved(
				{
					id: "m-8game",
					label: "8-Game",
					games: ["v-nlh", "v-brand-new"],
				},
				["NL Hold'em", "Brand New Game"]
			);
		});
		const allVariants = result.current.rows.flatMap((r) => r.variants);
		expect(allVariants).toEqual(["NL Hold'em", "Brand New Game"]);
	});
});
