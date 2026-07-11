import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MixGameGroupRow } from "@/shared/lib/mix-games";
import { useMixGamesEditor } from "../use-mix-games-editor";

function row(overrides: Partial<MixGameGroupRow> = {}): MixGameGroupRow {
	return {
		uid: crypto.randomUUID(),
		name: "Limit",
		variants: ["lhe", "o8"],
		blind1: "400",
		blind2: "800",
		blind3: "",
		ante: "",
		anteType: "none",
		...overrides,
	};
}

describe("useMixGamesEditor", () => {
	it("adds a blank group at the end", () => {
		const onChange = vi.fn();
		const value = [row()];
		const { result } = renderHook(() => useMixGamesEditor({ value, onChange }));
		result.current.onAddGroup();
		expect(onChange).toHaveBeenCalledTimes(1);
		const next = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(next).toHaveLength(2);
		expect(next[1].variants).toEqual([]);
	});

	it("removes a group by uid", () => {
		const onChange = vi.fn();
		const a = row();
		const b = row({ name: "Stud" });
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [a, b], onChange })
		);
		result.current.onRemoveGroup(a.uid);
		expect(onChange).toHaveBeenNthCalledWith(1, [b]);
	});

	it("moves a group up and down", () => {
		const onChange = vi.fn();
		const a = row({ name: "A" });
		const b = row({ name: "B" });
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [a, b], onChange })
		);
		result.current.onMoveUp(b.uid);
		expect(
			(onChange.mock.calls[0][0] as MixGameGroupRow[]).map((r) => r.name)
		).toEqual(["B", "A"]);
		result.current.onMoveDown(a.uid);
		expect(
			(onChange.mock.calls[1][0] as MixGameGroupRow[]).map((r) => r.name)
		).toEqual(["B", "A"]);
	});

	it("patches a group's fields", () => {
		const onChange = vi.fn();
		const a = row();
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [a], onChange })
		);
		result.current.onUpdateGroup(a.uid, { name: "Big Bet", blind1: "100" });
		const next = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(next[0].name).toBe("Big Bet");
		expect(next[0].blind1).toBe("100");
	});

	it("adds and removes variants through the duplicate guard", () => {
		const onChange = vi.fn();
		const a = row({ variants: ["lhe"] });
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [a], onChange })
		);
		result.current.onAddVariant(a.uid, "o8");
		expect(
			(onChange.mock.calls[0][0] as MixGameGroupRow[])[0].variants
		).toEqual(["lhe", "o8"]);
		// Duplicate additions are refused (rows unchanged → onChange still fires
		// with the same array content).
		result.current.onAddVariant(a.uid, "lhe");
		expect(
			(onChange.mock.calls[1][0] as MixGameGroupRow[])[0].variants
		).toEqual(["lhe"]);
		result.current.onRemoveVariant(a.uid, "lhe");
		expect(
			(onChange.mock.calls[2][0] as MixGameGroupRow[])[0].variants
		).toEqual([]);
	});

	it("applies a template, replacing current rows", () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [row()], onChange })
		);
		result.current.onApplyTemplate("8game");
		const next = onChange.mock.calls[0][0] as MixGameGroupRow[];
		expect(next.map((r) => r.name)).toEqual(["Limit", "Stud", "Big Bet"]);
	});

	it("exposes the used variants across all groups", () => {
		const a = row({ variants: ["lhe", "o8"] });
		const b = row({ name: "Big Bet", variants: ["nlh"] });
		const { result } = renderHook(() =>
			useMixGamesEditor({ value: [a, b], onChange: vi.fn() })
		);
		expect(result.current.usedVariantList).toEqual(["lhe", "o8", "nlh"]);
	});
});
