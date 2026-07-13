import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
	MixGameGroupRow,
	MixGroupInfo,
	ResolveGroup,
} from "@/shared/lib/mix-games";
import { addVariant, updateGroup } from "@/shared/lib/mix-games";
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

function setup(value: MixGameGroupRow[] = []) {
	const onChange = vi.fn();
	const { result } = renderHook(() =>
		useMixGamesEditor({ value, onChange, resolveGroup })
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

	it("removes a whole bucket by uid", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = addVariant(value, "Limit Hold'em", resolveGroup);
		const { result, onChange } = setup(value);
		const limitBucket = value.find((r) => r.groupId === "g-limit");
		result.current.onRemoveGroup(limitBucket?.uid ?? "");
		expect(onChange).toHaveBeenCalledTimes(1);
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows).toHaveLength(1);
		expect(rows[0].groupId).toBe("g-bigbet");
	});

	it("patches a bucket by uid", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		const { result, onChange } = setup(value);
		result.current.onUpdateGroup(value[0].uid, { name: "NL/PL" });
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows[0].name).toBe("NL/PL");
	});

	it("exposes the flat list of used variants", () => {
		const value = addVariant([], "NL Hold'em", resolveGroup);
		const { result } = setup(value);
		expect(result.current.usedVariantList).toEqual(["NL Hold'em"]);
	});

	it("clears the ante cell when the ante type changes to 'none'", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { ante: "75", anteType: "all" });
		const { result, onChange } = setup(value);
		result.current.onUpdateAnteType(value[0].uid, "none");
		expect(onChange).toHaveBeenCalledTimes(1);
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows[0].anteType).toBe("none");
		expect(rows[0].ante).toBe("");
	});

	it("keeps the ante cell when the ante type changes between paying types", () => {
		let value = addVariant([], "NL Hold'em", resolveGroup);
		value = updateGroup(value, value[0].uid, { ante: "75", anteType: "all" });
		const { result, onChange } = setup(value);
		result.current.onUpdateAnteType(value[0].uid, "bb");
		expect(onChange).toHaveBeenCalledTimes(1);
		const rows = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(rows[0].anteType).toBe("bb");
		expect(rows[0].ante).toBe("75");
	});
});
