import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";

const mocks = vi.hoisted(() => ({
	base: {
		filteredTags: [] as PlayerTagWithColor[],
		handleInputSubmit: vi.fn(),
		handleTagSelect: vi.fn(),
		inputValue: "",
		onInputChange: vi.fn(),
		onOpenChange: vi.fn(),
		shouldRenderPopover: false,
	},
	useTagPickerBaseSpy: vi.fn(),
}));

vi.mock("@/shared/components/ui/tag-picker-base/use-tag-picker-base", () => ({
	useTagPickerBase: (options: unknown) => {
		mocks.useTagPickerBaseSpy(options);
		return mocks.base;
	},
}));

import { useTagField } from "../use-tag-field";

function makeTag(
	overrides: Partial<PlayerTagWithColor> = {}
): PlayerTagWithColor {
	return { color: "gray", id: "t1", name: "Fish", ...overrides };
}

function makeKeyEvent(key: string): KeyboardEvent<HTMLInputElement> {
	return {
		key,
		preventDefault: vi.fn(),
	} as unknown as KeyboardEvent<HTMLInputElement>;
}

describe("useTagField", () => {
	beforeEach(() => {
		mocks.base.filteredTags = [];
		mocks.base.handleInputSubmit = vi.fn().mockResolvedValue(undefined);
		mocks.base.handleTagSelect = vi.fn();
		mocks.base.inputValue = "";
		mocks.base.onInputChange = vi.fn();
		mocks.base.onOpenChange = vi.fn();
		mocks.base.shouldRenderPopover = false;
		mocks.useTagPickerBaseSpy.mockReset();
	});

	it("forwards availableTags, onAdd, onCreateTag, onRemove and selectedTags to useTagPickerBase", () => {
		const onAdd = vi.fn();
		const onCreateTag = vi.fn();
		const onRemove = vi.fn();
		const selectedTags = [makeTag()];
		const availableTags = [makeTag({ id: "t2", name: "Reg" })];
		renderHook(() =>
			useTagField({ availableTags, onAdd, onCreateTag, onRemove, selectedTags })
		);
		expect(mocks.useTagPickerBaseSpy).toHaveBeenCalledTimes(1);
		expect(mocks.useTagPickerBaseSpy).toHaveBeenNthCalledWith(1, {
			availableTags,
			onAdd,
			onCreateTag,
			onRemove,
			selectedTags,
		});
	});

	describe("placeholder", () => {
		it("reads 'Add labels…' when there are no selected tags", () => {
			const { result } = renderHook(() =>
				useTagField({
					onAdd: vi.fn(),
					onRemove: vi.fn(),
					selectedTags: [],
				})
			);
			expect(result.current.placeholder).toBe("Add labels…");
		});

		it("reads 'Add label…' when there is at least one selected tag", () => {
			const { result } = renderHook(() =>
				useTagField({
					onAdd: vi.fn(),
					onRemove: vi.fn(),
					selectedTags: [makeTag()],
				})
			);
			expect(result.current.placeholder).toBe("Add label…");
		});
	});

	it("exposes isOpen from shouldRenderPopover and suggestions from filteredTags", () => {
		mocks.base.shouldRenderPopover = true;
		mocks.base.filteredTags = [makeTag({ id: "t9", name: "Nit" })];
		const { result } = renderHook(() =>
			useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
		);
		expect(result.current.isOpen).toBe(true);
		expect(result.current.suggestions).toBe(mocks.base.filteredTags);
	});

	it("onFocus opens the popover", () => {
		const { result } = renderHook(() =>
			useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
		);
		act(() => result.current.onFocus());
		expect(mocks.base.onOpenChange).toHaveBeenCalledTimes(1);
		expect(mocks.base.onOpenChange).toHaveBeenNthCalledWith(1, true);
	});

	it("onQueryChange updates the input value and opens the popover", () => {
		const { result } = renderHook(() =>
			useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
		);
		act(() => result.current.onQueryChange("re"));
		expect(mocks.base.onInputChange).toHaveBeenCalledTimes(1);
		expect(mocks.base.onInputChange).toHaveBeenNthCalledWith(1, "re");
		expect(mocks.base.onOpenChange).toHaveBeenCalledTimes(1);
		expect(mocks.base.onOpenChange).toHaveBeenNthCalledWith(1, true);
	});

	it("onSelectSuggestion is the picker's handleTagSelect", () => {
		const { result } = renderHook(() =>
			useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
		);
		expect(result.current.onSelectSuggestion).toBe(mocks.base.handleTagSelect);
	});

	describe("onKeyDown", () => {
		it("Enter prevents the default action and submits the input", () => {
			const { result } = renderHook(() =>
				useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
			);
			const event = makeKeyEvent("Enter");
			act(() => result.current.onKeyDown(event));
			expect(event.preventDefault).toHaveBeenCalledTimes(1);
			expect(mocks.base.handleInputSubmit).toHaveBeenCalledTimes(1);
		});

		it("Escape closes the popover without submitting", () => {
			const { result } = renderHook(() =>
				useTagField({ onAdd: vi.fn(), onRemove: vi.fn(), selectedTags: [] })
			);
			const event = makeKeyEvent("Escape");
			act(() => result.current.onKeyDown(event));
			expect(mocks.base.onOpenChange).toHaveBeenCalledTimes(1);
			expect(mocks.base.onOpenChange).toHaveBeenNthCalledWith(1, false);
			expect(mocks.base.handleInputSubmit).not.toHaveBeenCalled();
		});

		it("Backspace with an empty query removes the last selected tag", () => {
			const onRemove = vi.fn();
			const tagA = makeTag({ id: "t1", name: "Fish" });
			const tagB = makeTag({ id: "t2", name: "Reg" });
			mocks.base.inputValue = "";
			const { result } = renderHook(() =>
				useTagField({ onAdd: vi.fn(), onRemove, selectedTags: [tagA, tagB] })
			);
			act(() => result.current.onKeyDown(makeKeyEvent("Backspace")));
			expect(onRemove).toHaveBeenCalledTimes(1);
			expect(onRemove).toHaveBeenNthCalledWith(1, tagB);
		});

		it("Backspace with an empty query and no selected tags does nothing", () => {
			const onRemove = vi.fn();
			mocks.base.inputValue = "";
			const { result } = renderHook(() =>
				useTagField({ onAdd: vi.fn(), onRemove, selectedTags: [] })
			);
			act(() => result.current.onKeyDown(makeKeyEvent("Backspace")));
			expect(onRemove).not.toHaveBeenCalled();
		});

		it("Backspace while the query has text does not remove a tag", () => {
			const onRemove = vi.fn();
			mocks.base.inputValue = "re";
			const { result } = renderHook(() =>
				useTagField({
					onAdd: vi.fn(),
					onRemove,
					selectedTags: [makeTag()],
				})
			);
			act(() => result.current.onKeyDown(makeKeyEvent("Backspace")));
			expect(onRemove).not.toHaveBeenCalled();
		});

		it("ignores other keys", () => {
			const onRemove = vi.fn();
			const { result } = renderHook(() =>
				useTagField({
					onAdd: vi.fn(),
					onRemove,
					selectedTags: [makeTag()],
				})
			);
			act(() => result.current.onKeyDown(makeKeyEvent("a")));
			expect(onRemove).not.toHaveBeenCalled();
			expect(mocks.base.handleInputSubmit).not.toHaveBeenCalled();
			expect(mocks.base.onOpenChange).not.toHaveBeenCalled();
		});
	});
});
