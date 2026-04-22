import { useState } from "react";

interface UsePlayerFiltersProps {
	onTagIdsChange: (tagIds: string[]) => void;
	selectedTagIds: string[];
}

export function usePlayerFilters({
	onTagIdsChange,
	selectedTagIds,
}: UsePlayerFiltersProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [draft, setDraft] = useState<string[]>(selectedTagIds);

	const handleOpen = () => {
		setDraft(selectedTagIds);
		setIsOpen(true);
	};

	const toggleTag = (tagId: string) => {
		setDraft((prev) =>
			prev.includes(tagId)
				? prev.filter((id) => id !== tagId)
				: [...prev, tagId]
		);
	};

	const handleApply = () => {
		onTagIdsChange(draft);
		setIsOpen(false);
	};

	const handleReset = () => {
		setDraft([]);
		onTagIdsChange([]);
		setIsOpen(false);
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setIsOpen(false);
		}
	};

	return {
		draft,
		isOpen,
		onApply: handleApply,
		onOpen: handleOpen,
		onOpenChange: handleOpenChange,
		onReset: handleReset,
		toggleTag,
	};
}
