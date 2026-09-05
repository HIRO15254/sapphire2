import type { KeyboardEvent } from "react";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { useTagPickerBase } from "@/shared/components/ui/tag-picker-base/use-tag-picker-base";

interface UseTagFieldOptions {
	availableTags?: PlayerTagWithColor[];
	onAdd: (tag: PlayerTagWithColor) => void;
	onCreateTag?: (name: string) => Promise<PlayerTagWithColor>;
	onRemove: (tag: PlayerTagWithColor) => void;
	selectedTags: PlayerTagWithColor[];
}

export function useTagField({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	selectedTags,
}: UseTagFieldOptions) {
	const {
		filteredTags,
		handleInputSubmit,
		handleTagSelect,
		inputValue,
		onInputChange,
		onOpenChange,
		shouldRenderPopover,
	} = useTagPickerBase({
		availableTags,
		onAdd,
		onCreateTag,
		onRemove,
		selectedTags,
	});

	const onQueryChange = (value: string) => {
		onInputChange(value);
		onOpenChange(true);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			handleInputSubmit().catch(() => undefined);
			return;
		}
		if (event.key === "Escape") {
			onOpenChange(false);
			return;
		}
		if (
			event.key === "Backspace" &&
			inputValue === "" &&
			selectedTags.length > 0
		) {
			const lastTag = selectedTags.at(-1);
			if (lastTag) {
				onRemove(lastTag);
			}
		}
	};

	return {
		inputValue,
		isOpen: shouldRenderPopover,
		onFocus: () => onOpenChange(true),
		onKeyDown,
		onQueryChange,
		onSelectSuggestion: handleTagSelect,
		placeholder: selectedTags.length > 0 ? "Add label…" : "Add labels…",
		suggestions: filteredTags,
	};
}
