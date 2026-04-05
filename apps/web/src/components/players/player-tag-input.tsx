import { IconX } from "@tabler/icons-react";
import { ColorBadge } from "@/components/players/color-badge";
import { TagPickerBase } from "@/components/ui/tag-picker-base";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface PlayerTagInputProps {
	availableTags?: TagWithColor[];
	onAdd: (tag: TagWithColor) => void;
	onCreateTag?: (name: string) => Promise<TagWithColor>;
	onRemove: (tag: TagWithColor) => void;
	placeholder?: string;
	selectedTags: TagWithColor[];
}

export function PlayerTagInput({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	placeholder = "Type to search or create tags...",
	selectedTags,
}: PlayerTagInputProps) {
	return (
		<TagPickerBase
			availableTags={availableTags}
			onAdd={onAdd}
			onCreateTag={onCreateTag}
			onRemove={onRemove}
			placeholder={placeholder}
			renderSelectedTag={(tag, handleRemove) => (
				<ColorBadge className="gap-1 pr-1" color={tag.color}>
					{tag.name}
					<button
						aria-label={`Remove tag ${tag.name}`}
						className="opacity-70 hover:opacity-100"
						onClick={handleRemove}
						type="button"
					>
						<IconX size={10} />
					</button>
				</ColorBadge>
			)}
			renderSuggestion={(tag) => (
				<ColorBadge color={tag.color}>{tag.name}</ColorBadge>
			)}
			searchAriaLabel="Search player tags"
			selectedTags={selectedTags}
		/>
	);
}
