import { useState } from "react";
import { PlayerTagInput } from "@/players/components/player-tag-input";
import { FilterDialogShell } from "@/shared/components/filter-dialog-shell";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";

interface TagItem {
	color: string;
	id: string;
	name: string;
}

interface PlayerFiltersProps {
	availableTags: TagItem[];
	onTagIdsChange: (tagIds: string[]) => void;
	selectedTagIds: string[];
}

export function PlayerFilters({
	availableTags,
	onTagIdsChange,
	selectedTagIds,
}: PlayerFiltersProps) {
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

	return (
		<FilterDialogShell
			activeCount={selectedTagIds.length}
			description="Select one or more tags to narrow the player list."
			onApply={handleApply}
			onOpen={handleOpen}
			onOpenChange={(open) => {
				if (!open) {
					setIsOpen(false);
				}
			}}
			onReset={handleReset}
			open={isOpen}
			title="Filter by Tags"
		>
			{availableTags.length === 0 ? (
				<EmptyState
					className="border-none bg-transparent px-0 py-4"
					description="Create tags first."
					heading="No tags available"
				/>
			) : (
				<Field description="Search and select multiple tags." label="Tags">
					<PlayerTagInput
						availableTags={availableTags}
						onAdd={(tag) => toggleTag(tag.id)}
						onRemove={(tag) => toggleTag(tag.id)}
						placeholder="Search tags"
						selectedTags={draft
							.map((id) => availableTags.find((tag) => tag.id === id))
							.filter((tag): tag is TagItem => tag !== undefined)}
					/>
				</Field>
			)}
		</FilterDialogShell>
	);
}
