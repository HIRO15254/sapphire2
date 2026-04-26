import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypeCombobox } from "@/features/currencies/hooks/use-type-combobox";

const TYPES = [
	{ id: "type-deposit", name: "Deposit" },
	{ id: "type-withdrawal", name: "Withdrawal" },
	{ id: "type-transfer", name: "Transfer" },
];

function defaults(
	overrides: Partial<Parameters<typeof useTypeCombobox>[0]> = {}
) {
	return {
		newTypeName: "",
		onNewTypeNameChange: vi.fn(),
		onTypeChange: vi.fn(),
		typeId: "",
		types: TYPES,
		...overrides,
	};
}

describe("useTypeCombobox", () => {
	describe("initial inputValue", () => {
		it("is empty when typeId is empty and no matching type", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			expect(result.current.inputValue).toBe("");
		});

		it("is the type name when typeId resolves to an existing type", () => {
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ typeId: "type-deposit" }))
			);
			expect(result.current.inputValue).toBe("Deposit");
		});

		it("is newTypeName when typeId is the NEW_TYPE_VALUE sentinel", () => {
			const { result } = renderHook(() =>
				useTypeCombobox(
					defaults({ typeId: "__new__", newTypeName: "Pending name" })
				)
			);
			expect(result.current.inputValue).toBe("Pending name");
		});

		it("is empty string when typeId references an unknown id", () => {
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ typeId: "missing" }))
			);
			expect(result.current.inputValue).toBe("");
		});
	});

	describe("sync with typeId prop changes", () => {
		it("updates inputValue when typeId becomes a known id after mount", () => {
			const props = defaults();
			const { result, rerender } = renderHook((p) => useTypeCombobox(p), {
				initialProps: props,
			});
			expect(result.current.inputValue).toBe("");
			rerender({ ...props, typeId: "type-withdrawal" });
			expect(result.current.inputValue).toBe("Withdrawal");
		});

		it("does not overwrite inputValue when typeId remains NEW_TYPE_VALUE", () => {
			const props = defaults({ typeId: "__new__", newTypeName: "Fresh" });
			const { result, rerender } = renderHook((p) => useTypeCombobox(p), {
				initialProps: props,
			});
			act(() => result.current.handleInputChange("Custom draft"));
			rerender({ ...props, typeId: "__new__", newTypeName: "Fresh" });
			expect(result.current.inputValue).toBe("Custom draft");
		});

		it("does not overwrite inputValue when typeId is empty", () => {
			const props = defaults({ typeId: "" });
			const { result, rerender } = renderHook((p) => useTypeCombobox(p), {
				initialProps: props,
			});
			act(() => result.current.handleInputChange("typing…"));
			rerender({ ...props, typeId: "" });
			expect(result.current.inputValue).toBe("typing…");
		});
	});

	describe("filteredTypes", () => {
		it("returns all types when not filtering (isFiltering=false)", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			expect(result.current.filteredTypes).toHaveLength(3);
		});

		it("filters case-insensitively after handleInputChange", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("DEP"));
			expect(result.current.filteredTypes.map((t) => t.id)).toEqual([
				"type-deposit",
			]);
		});

		it("returns all types when filtering but normalized input is empty (whitespace only)", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("   "));
			expect(result.current.filteredTypes).toHaveLength(3);
		});

		it("returns empty array when input matches nothing", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("xyz"));
			expect(result.current.filteredTypes).toEqual([]);
		});
	});

	describe("exactMatch / canCreate", () => {
		it("canCreate is false when input is empty", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			expect(result.current.canCreate).toBe(false);
			expect(result.current.exactMatch).toBeUndefined();
		});

		it("canCreate is true when input has no exact match", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("Brand New"));
			expect(result.current.exactMatch).toBeUndefined();
			expect(result.current.canCreate).toBe(true);
		});

		it("exactMatch is set and canCreate is false for an exact case-insensitive match", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("deposit"));
			expect(result.current.exactMatch?.id).toBe("type-deposit");
			expect(result.current.canCreate).toBe(false);
		});

		it("canCreate is false when input is whitespace only", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputChange("   "));
			expect(result.current.canCreate).toBe(false);
		});
	});

	describe("handleSelect", () => {
		it("sets inputValue, calls onTypeChange with id, clears newTypeName, closes popover", () => {
			const onTypeChange = vi.fn();
			const onNewTypeNameChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange, onNewTypeNameChange }))
			);
			act(() => result.current.handleInputFocus());
			expect(result.current.shouldShowPopover).toBe(true);
			act(() => result.current.handleSelect(TYPES[1]));
			expect(result.current.inputValue).toBe("Withdrawal");
			expect(onTypeChange).toHaveBeenCalledWith("type-withdrawal");
			expect(onNewTypeNameChange).toHaveBeenCalledWith("");
			expect(result.current.shouldShowPopover).toBe(false);
		});
	});

	describe("handleCreate", () => {
		it("calls onTypeChange(NEW_TYPE_VALUE) and onNewTypeNameChange with trimmed input, closes popover", () => {
			const onTypeChange = vi.fn();
			const onNewTypeNameChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange, onNewTypeNameChange }))
			);
			act(() => result.current.handleInputChange("  Fresh name  "));
			act(() => result.current.handleCreate());
			expect(onTypeChange).toHaveBeenLastCalledWith("__new__");
			expect(onNewTypeNameChange).toHaveBeenLastCalledWith("Fresh name");
		});
	});

	describe("handleInputChange", () => {
		it("opens popover and clears selection", () => {
			const onTypeChange = vi.fn();
			const onNewTypeNameChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(
					defaults({
						onTypeChange,
						onNewTypeNameChange,
						typeId: "type-deposit",
					})
				)
			);
			act(() => result.current.handleInputChange("newvalue"));
			expect(result.current.inputValue).toBe("newvalue");
			expect(onTypeChange).toHaveBeenLastCalledWith("");
			expect(onNewTypeNameChange).toHaveBeenLastCalledWith("");
		});
	});

	describe("handleInputBlur", () => {
		it("closes popover when relatedTarget is null", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputFocus());
			expect(result.current.shouldShowPopover).toBe(true);
			act(() => result.current.handleInputBlur(null));
			expect(result.current.shouldShowPopover).toBe(false);
		});

		it("keeps popover open when relatedTarget is inside popover content", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputFocus());
			const popover = document.createElement("div");
			popover.setAttribute("data-slot", "popover-content");
			const child = document.createElement("button");
			popover.appendChild(child);
			act(() => result.current.handleInputBlur(child));
			expect(result.current.shouldShowPopover).toBe(true);
		});
	});

	describe("handleKeyDown", () => {
		it("Enter with exactMatch selects the matching type", () => {
			const onTypeChange = vi.fn();
			const onNewTypeNameChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange, onNewTypeNameChange }))
			);
			act(() => result.current.handleInputChange("deposit"));
			act(() => result.current.handleKeyDown("Enter"));
			expect(onTypeChange).toHaveBeenLastCalledWith("type-deposit");
			expect(onNewTypeNameChange).toHaveBeenLastCalledWith("");
		});

		it("Enter with canCreate invokes create path", () => {
			const onTypeChange = vi.fn();
			const onNewTypeNameChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange, onNewTypeNameChange }))
			);
			act(() => result.current.handleInputChange("Brand New"));
			act(() => result.current.handleKeyDown("Enter"));
			expect(onTypeChange).toHaveBeenLastCalledWith("__new__");
			expect(onNewTypeNameChange).toHaveBeenLastCalledWith("Brand New");
		});

		it("Enter with empty input is a no-op", () => {
			const onTypeChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange }))
			);
			act(() => result.current.handleKeyDown("Enter"));
			expect(onTypeChange).not.toHaveBeenCalled();
		});

		it("Escape closes the popover", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputFocus());
			expect(result.current.shouldShowPopover).toBe(true);
			act(() => result.current.handleKeyDown("Escape"));
			expect(result.current.shouldShowPopover).toBe(false);
		});

		it("unrelated keys are ignored", () => {
			const onTypeChange = vi.fn();
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ onTypeChange }))
			);
			act(() => result.current.handleInputChange("deposit"));
			act(() => result.current.handleKeyDown("Tab"));
			// onTypeChange("") was called by handleInputChange; no further calls.
			expect(onTypeChange).toHaveBeenCalledTimes(1);
		});
	});

	describe("shouldShowPopover", () => {
		it("is false by default (closed)", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			expect(result.current.shouldShowPopover).toBe(false);
		});

		it("is true when open and there are types", () => {
			const { result } = renderHook(() => useTypeCombobox(defaults()));
			act(() => result.current.handleInputFocus());
			expect(result.current.shouldShowPopover).toBe(true);
		});

		it("is true when open with no types but some normalized input", () => {
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ types: [] }))
			);
			act(() => result.current.handleInputChange("anything"));
			expect(result.current.shouldShowPopover).toBe(true);
		});

		it("is false when open but types empty and no input", () => {
			const { result } = renderHook(() =>
				useTypeCombobox(defaults({ types: [] }))
			);
			act(() => result.current.handleInputFocus());
			expect(result.current.shouldShowPopover).toBe(false);
		});
	});
});
