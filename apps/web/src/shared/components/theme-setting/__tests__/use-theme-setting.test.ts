import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { THEME_OPTIONS, useThemeSetting } from "../use-theme-setting";

const mocks = vi.hoisted(() => ({
	setTheme: vi.fn(),
	theme: undefined as string | undefined,
}));

vi.mock("next-themes", () => ({
	useTheme: () => ({
		setTheme: mocks.setTheme,
		theme: mocks.theme,
	}),
}));

describe("THEME_OPTIONS", () => {
	it("has 3 options in order: light, dark, system", () => {
		expect(THEME_OPTIONS).toHaveLength(3);
		expect(THEME_OPTIONS[0].value).toBe("light");
		expect(THEME_OPTIONS[0].label).toBe("Light");
		expect(THEME_OPTIONS[1].value).toBe("dark");
		expect(THEME_OPTIONS[1].label).toBe("Dark");
		expect(THEME_OPTIONS[2].value).toBe("system");
		expect(THEME_OPTIONS[2].label).toBe("System");
	});

	it("each option has an icon", () => {
		for (const option of THEME_OPTIONS) {
			expect(option.icon).toBeDefined();
		}
	});
});

describe("useThemeSetting", () => {
	it("returns options identical to THEME_OPTIONS", () => {
		const { result } = renderHook(() => useThemeSetting());
		expect(result.current.options).toBe(THEME_OPTIONS);
	});

	it("delegates onValueChange to setTheme with the given value", () => {
		const { result } = renderHook(() => useThemeSetting());

		act(() => {
			result.current.onValueChange("light");
		});
		expect(mocks.setTheme).toHaveBeenCalledTimes(1);
		expect(mocks.setTheme).toHaveBeenCalledWith("light");

		act(() => {
			result.current.onValueChange("dark");
		});
		expect(mocks.setTheme).toHaveBeenCalledTimes(2);
		expect(mocks.setTheme).toHaveBeenNthCalledWith(2, "dark");

		act(() => {
			result.current.onValueChange("system");
		});
		expect(mocks.setTheme).toHaveBeenCalledTimes(3);
		expect(mocks.setTheme).toHaveBeenNthCalledWith(3, "system");
	});

	it("returns value reflecting the current theme after mount", () => {
		mocks.theme = "light";
		const { result } = renderHook(() => useThemeSetting());
		expect(result.current.value).toBe("light");
	});

	it("returns value 'dark' when theme is 'dark'", () => {
		mocks.theme = "dark";
		const { result } = renderHook(() => useThemeSetting());
		expect(result.current.value).toBe("dark");
	});

	it("returns empty string when theme is undefined", () => {
		mocks.theme = undefined;
		const { result } = renderHook(() => useThemeSetting());
		expect(result.current.value).toBe("");
	});
});
