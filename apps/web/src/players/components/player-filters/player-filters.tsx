import { PlayerTagInput } from "@/players/components/player-tag-input";
import { FilterDialogShell } from "@/shared/components/filter-dialog-shell";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Field } from "@/shared/components/ui/field";
import { usePlayerFilters } from "./use-player-filters";

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
	const { draft, isOpen, onApply, onOpen, onOpenChange, onReset, toggleTag } =
		usePlayerFilters({ onTagIdsChange, selectedTagIds });

	return (
		<FilterDialogShell
			activeCount={selectedTagIds.length}
			onApply={onApply}
			onOpen={onOpen}
			onOpenChange={onOpenChange}
			onReset={onReset}
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
				<Field label="Tags">
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
