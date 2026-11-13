import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIconSuggestion } from "../use-icon-suggestion";

function setup(initialIcon: string) {
	const state = { icon: initialIcon };
	const { result } = renderHook(() =>
		useIconSuggestion({
			getIcon: () => state.icon,
			initialIcon,
			setIcon: (name) => {
				state.icon = name;
			},
		})
	);
	return { result, state };
}

describe("useIconSuggestion", () => {
	it("fills an unset icon from the name and follows later renames", async () => {
		const { result, state } = setup("");

		await act(() => result.current.onNameBlur("Coffee"));
		expect(state.icon).toBe("coffee");

		await act(() => result.current.onNameBlur("Pizza"));
		expect(state.icon).toBe("pizza");
	});

	it("never overwrites an icon the user picked, including None", async () => {
		const { result, state } = setup("");

		act(() => result.current.onIconChosen());
		await act(() => result.current.onNameBlur("Coffee"));

		expect(state.icon).toBe("");
	});

	it("keeps the existing icon of an item opened for editing", async () => {
		const { result, state } = setup("gift");

		await act(() => result.current.onNameBlur("Coffee"));

		expect(state.icon).toBe("gift");
	});

	it("drops a suggestion that resolves after the user picked an icon", async () => {
		const { result, state } = setup("");

		const pending = result.current.onNameBlur("Coffee");
		act(() => result.current.onIconChosen());
		state.icon = "star";
		await act(() => pending);

		expect(state.icon).toBe("star");
	});
});
