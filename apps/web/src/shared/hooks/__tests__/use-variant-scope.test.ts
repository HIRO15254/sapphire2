import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { scopeOf, useVariantScope } from "../use-variant-scope";

describe("scopeOf", () => {
	it("derives 'perLevel' only from the per-level sentinel value", () => {
		expect(scopeOf("mix")).toBe("perLevel");
		expect(scopeOf(" MIX ")).toBe("perLevel");
		expect(scopeOf("8-Game")).toBe("all");
		expect(scopeOf("NL Hold'em")).toBe("all");
		expect(scopeOf("")).toBe("all");
	});
});

describe("useVariantScope", () => {
	it("exposes scopeOf for callers", () => {
		const { result } = renderHook(() =>
			useVariantScope({ setVariant: vi.fn() })
		);
		expect(result.current.scopeOf("mix")).toBe("perLevel");
		expect(result.current.scopeOf("Razz")).toBe("all");
	});

	it("is a no-op when the requested scope matches the current variant's scope", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() => useVariantScope({ setVariant }));
		act(() => {
			result.current.onScopeChange("all", "NL Hold'em");
		});
		act(() => {
			result.current.onScopeChange("perLevel", "mix");
		});
		expect(setVariant).not.toHaveBeenCalled();
	});

	it("switching to per-level freezes the sentinel through setVariant", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() => useVariantScope({ setVariant }));
		act(() => {
			result.current.onScopeChange("perLevel", "NL Hold'em");
		});
		expect(setVariant).toHaveBeenCalledTimes(1);
		expect(setVariant).toHaveBeenNthCalledWith(1, "mix");
	});

	it("switching back restores the variant remembered from the last switch", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() => useVariantScope({ setVariant }));
		act(() => {
			result.current.onScopeChange("perLevel", "8-Game");
		});
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(setVariant).toHaveBeenCalledTimes(2);
		expect(setVariant).toHaveBeenNthCalledWith(2, "8-Game");
	});

	it("remembers an all-scope initialVariant as the switch-back target", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() =>
			useVariantScope({ initialVariant: "Razz", setVariant })
		);
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(setVariant).toHaveBeenCalledTimes(1);
		expect(setVariant).toHaveBeenNthCalledWith(1, "Razz");
	});

	it("falls back to the default label when the initial variant was per-level", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() =>
			useVariantScope({ initialVariant: "mix", setVariant })
		);
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(setVariant).toHaveBeenCalledTimes(1);
		expect(setVariant).toHaveBeenNthCalledWith(1, "NL Hold'em");
	});

	it("falls back to the default label without any initial variant", () => {
		const setVariant = vi.fn();
		const { result } = renderHook(() => useVariantScope({ setVariant }));
		act(() => {
			result.current.onScopeChange("all", "mix");
		});
		expect(setVariant).toHaveBeenCalledTimes(1);
		expect(setVariant).toHaveBeenNthCalledWith(1, "NL Hold'em");
	});
});
