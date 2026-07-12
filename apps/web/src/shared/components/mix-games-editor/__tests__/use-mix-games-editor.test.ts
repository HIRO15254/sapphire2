import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
	MixGameGroupRow,
	MixGroupInfo,
	ResolveGroup,
} from "@/shared/lib/mix-games";
import { addVariant } from "@/shared/lib/mix-games";
import { useMixGamesEditor } from "../use-mix-games-editor";

const BIGBET: MixGroupInfo = {
	id: "g-bigbet",
	label: "Big Bet",
	blind1Label: "SB",
	blind2Label: "BB",
	blind3Label: "Straddle",
	sortIndex: 2,
};

const LIMIT: MixGroupInfo = {
	id: "g-limit",
	label: "Limit",
	blind1Label: "Small Bet",
	blind2Label: "Big Bet",
	blind3Label: null,
	sortIndex: 0,
};

const resolveGroup: ResolveGroup = (variant) =>
	variant.startsWith("Limit") ? LIMIT : BIGBET;

const resolveVariantLabel = (key: string): string | null =>
	({ nlh: "NL Hold'em", lhe: "Limit Hold'em" })[key] ?? null;

function setup(value: MixGameGroupRow[] = []) {
	const onChange = vi.fn();
	const { result } = renderHook(() =>
		useMixGamesEditor({ value, onChange, resolveGroup, resolveVariantLabel })
	);
	return { result, onChange };
}

describe("useMixGamesEditor", () => {
	it("adds a game into its derived bucket", () => {
		const { result, onChange } = setup();
		result.current.onAddVariant("NL Hold'em");
		expect(onChange).toHaveBeenCalledTimes(1);
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows[0].groupId).toBe("g-bigbet");
		expect(rows[0].variants).toEqual(["NL Hold'em"]);
	});

	it("removes a game and drops the emptied bucket", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		const { result, onChange } = setup(value);
		result.current.onRemoveVariant("NL Hold'em");
		expect(onChange).toHaveBeenNthCalledWith(1, []);
	});

	it("patches a bucket by uid", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		const { result, onChange } = setup(value);
		result.current.onUpdateGroup(value[0].uid, { name: "NL/PL" });
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows[0].name).toBe("NL/PL");
	});

	it("applies a template resolved through the master data", () => {
		const { result, onChange } = setup();
		result.current.onApplyTemplate("horse");
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		// Only lhe resolves in this fixture; the other HORSE keys are absent.
		expect(rows).toHaveLength(1);
		expect(rows[0].variants).toEqual(["Limit Hold'em"]);
	});

	it("exposes the flat list of used variants", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		const { result } = setup(value);
		expect(result.current.usedVariantList).toEqual(["NL Hold'em"]);
	});
});
