import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTagForm } from "@/features/players/components/player-tag-manager/use-player-tag-manager";

describe("useTagForm", () => {
	it("defaults selectedColor to 'gray' when no defaults are provided", () => {
		const { result } = renderHook(() => useTagForm({}));
		expect(result.current.selectedColor).toBe("gray");
	});

	it("seeds selectedColor from defaultValues", () => {
		const { result } = renderHook(() =>
			useTagForm({ defaultValues: { color: "red", name: "VIP" } })
		);
		expect(result.current.selectedColor).toBe("red");
	});

	it("onColorChange updates selectedColor", () => {
		const { result } = renderHook(() => useTagForm({}));
		act(() => {
			result.current.onColorChange("blue");
		});
		expect(result.current.selectedColor).toBe("blue");
	});

	it("supports switching colors multiple times", () => {
		const { result } = renderHook(() =>
			useTagForm({ defaultValues: { color: "green", name: "x" } })
		);
		act(() => {
			result.current.onColorChange("purple");
		});
		expect(result.current.selectedColor).toBe("purple");
		act(() => {
			result.current.onColorChange("pink");
		});
		expect(result.current.selectedColor).toBe("pink");
	});
});
