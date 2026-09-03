import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTagPickerBase } from "@/shared/components/ui/tag-picker-base/use-tag-picker-base";

interface Tag {
	id: string;
	name: string;
}

const VIP_TAG: Tag = { id: "t1", name: "VIP" };
const BAN_TAG: Tag = { id: "t2", name: "Banned" };
const REG_TAG: Tag = { id: "t3", name: "Regular" };
const ALL_TAGS: Tag[] = [VIP_TAG, BAN_TAG, REG_TAG];

function setup(
	overrides: Partial<Parameters<typeof useTagPickerBase>[0]> = {}
) {
	const onAdd = vi.fn();
	const onRemove = vi.fn();
	const onCreateTag = vi.fn();
	return {
		onAdd,
		onRemove,
		onCreateTag,
		hook: renderHook(
			(props: Parameters<typeof useTagPickerBase>[0]) =>
				useTagPickerBase(props),
			{
				initialProps: {
					availableTags: ALL_TAGS,
					onAdd,
					onCreateTag,
					onRemove,
					selectedTags: [] as Tag[],
					...overrides,
				},
			}
		),
	};
}

describe("useTagPickerBase", () => {
	describe("initial state", () => {
		it("is closed with empty input", () => {
			const { hook } = setup();
			expect(hook.result.current.isOpen).toBe(false);
			expect(hook.result.current.inputValue).toBe("");
			expect(hook.result.current.normalizedInput).toBe("");
			expect(hook.result.current.contentWidth).toBeUndefined();
		});

		it("returns all unselected tags", () => {
			const { hook } = setup();
			expect(hook.result.current.filteredTags.map((t) => t.id)).toEqual([
				"t1",
				"t2",
				"t3",
			]);
		});
	});

	describe("filtering", () => {
		it("excludes already-selected tags", () => {
			const { hook } = setup({ selectedTags: [VIP_TAG] });
			expect(hook.result.current.filteredTags.map((t) => t.id)).not.toContain(
				"t1"
			);
		});

		it("filters by substring case-insensitively", () => {
			const { hook } = setup();
			act(() => hook.result.current.onInputChange("reg"));
			expect(hook.result.current.filteredTags.map((t) => t.id)).toEqual(["t3"]);
		});

		it("trims whitespace for normalizedInput", () => {
			const { hook } = setup();
			act(() => hook.result.current.onInputChange("  VIP  "));
			expect(hook.result.current.normalizedInput).toBe("VIP");
		});
	});

	describe("canCreate", () => {
		it.each([
			{ input: "NewTag", hasOnCreateTag: true, expected: true },
			{ input: "vip", hasOnCreateTag: true, expected: false },
			{ input: "NewTag", hasOnCreateTag: false, expected: false },
			{ input: "", hasOnCreateTag: true, expected: false },
		])("is $expected for input=$input, onCreateTag provided=$hasOnCreateTag", ({
			input,
			hasOnCreateTag,
			expected,
		}) => {
			const { hook } = setup({
				onCreateTag: hasOnCreateTag ? vi.fn() : undefined,
			});
			act(() => hook.result.current.onInputChange(input));
			expect(hook.result.current.canCreate).toBe(expected);
		});
	});

	describe("handleTagSelect", () => {
		it("calls onAdd, resets input, closes the picker", () => {
			const { hook, onAdd } = setup();
			act(() => hook.result.current.onInputChange("vip"));
			act(() => hook.result.current.onOpenChange(true));
			act(() => hook.result.current.handleTagSelect(VIP_TAG));
			expect(onAdd).toHaveBeenCalledWith(ALL_TAGS[0]);
			expect(hook.result.current.inputValue).toBe("");
			expect(hook.result.current.isOpen).toBe(false);
		});
	});

	describe("handleInputSubmit", () => {
		it("is a no-op when input is empty", async () => {
			const { hook, onAdd, onCreateTag } = setup();
			await act(async () => {
				await hook.result.current.handleInputSubmit();
			});
			expect(onAdd).not.toHaveBeenCalled();
			expect(onCreateTag).not.toHaveBeenCalled();
		});

		it("selects the matching existing tag if not already selected", async () => {
			const { hook, onAdd } = setup();
			act(() => hook.result.current.onInputChange("Regular"));
			await act(async () => {
				await hook.result.current.handleInputSubmit();
			});
			expect(onAdd).toHaveBeenCalledWith(REG_TAG);
		});

		it("does not re-add when the matching tag is already selected", async () => {
			const { hook, onAdd } = setup({ selectedTags: [VIP_TAG] });
			act(() => hook.result.current.onInputChange("VIP"));
			await act(async () => {
				await hook.result.current.handleInputSubmit();
			});
			expect(onAdd).not.toHaveBeenCalled();
		});

		it("calls onCreateTag and then onAdd with the new tag when no match exists", async () => {
			const { hook, onAdd, onCreateTag } = setup();
			const created: Tag = { id: "new", name: "Fresh" };
			onCreateTag.mockResolvedValue(created);

			act(() => hook.result.current.onInputChange("Fresh"));
			await act(async () => {
				await hook.result.current.handleInputSubmit();
			});
			expect(onCreateTag).toHaveBeenCalledWith("Fresh");
			expect(onAdd).toHaveBeenCalledWith(created);
		});

		it("silently skips creation when onCreateTag is not provided and no match exists", async () => {
			const { hook, onAdd } = setup({ onCreateTag: undefined });
			act(() => hook.result.current.onInputChange("Nonexistent"));
			await act(async () => {
				await hook.result.current.handleInputSubmit();
			});
			expect(onAdd).not.toHaveBeenCalled();
		});
	});

	describe("shouldRenderPopover", () => {
		it.each([
			{ isOpen: false, hasTags: true, input: "", expected: false },
			{ isOpen: true, hasTags: true, input: "", expected: true },
			{ isOpen: true, hasTags: false, input: "anything", expected: true },
			{ isOpen: true, hasTags: false, input: "", expected: false },
		])("is $expected for isOpen=$isOpen, hasTags=$hasTags, input=$input", ({
			isOpen,
			hasTags,
			input,
			expected,
		}) => {
			const { hook } = setup({ availableTags: hasTags ? ALL_TAGS : [] });
			act(() => hook.result.current.onOpenChange(isOpen));
			if (input) {
				act(() => hook.result.current.onInputChange(input));
			}
			expect(hook.result.current.shouldRenderPopover).toBe(expected);
		});
	});

	describe("closeAndReset", () => {
		it("clears input and closes", () => {
			const { hook } = setup();
			act(() => hook.result.current.onInputChange("vip"));
			act(() => hook.result.current.onOpenChange(true));
			act(() => hook.result.current.closeAndReset());
			expect(hook.result.current.inputValue).toBe("");
			expect(hook.result.current.isOpen).toBe(false);
		});
	});
});
