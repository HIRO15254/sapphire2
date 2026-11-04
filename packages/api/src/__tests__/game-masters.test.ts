import { describe, expect, it } from "vitest";
import { compareBuiltinFirst } from "../routers/_game-masters";

describe("compareBuiltinFirst", () => {
	const order = new Map([
		["a", 0],
		["b", 1],
	]);
	const compare = compareBuiltinFirst(order);

	it("sorts builtin rows by the order map, ahead of custom rows", () => {
		const rows = [
			{ builtinKey: null, label: "Zeta Custom" },
			{ builtinKey: "b", label: "B" },
			{ builtinKey: "a", label: "A" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"A",
			"B",
			"Zeta Custom",
		]);
	});

	it("sorts custom rows alphabetically by label", () => {
		const rows = [
			{ builtinKey: null, label: "Zeta" },
			{ builtinKey: null, label: "Alpha" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"Alpha",
			"Zeta",
		]);
	});

	it("treats a builtinKey absent from the order map as a custom row", () => {
		const rows = [
			{ builtinKey: "unknown-key", label: "Unknown" },
			{ builtinKey: "a", label: "A" },
		];
		expect([...rows].sort(compare).map((r) => r.label)).toEqual([
			"A",
			"Unknown",
		]);
	});
});
