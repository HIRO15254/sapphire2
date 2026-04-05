import { IconX } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { TagPickerBase } from "@/components/ui/tag-picker-base";

interface Tag {
	id: string;
	name: string;
}

interface TagInputProps {
	availableTags?: Tag[];
	onAdd: (tag: Tag) => void;
	onCreateTag?: (name: string) => Promise<Tag>;
	onRemove: (tag: Tag) => void;
	placeholder?: string;
	selectedTags: Tag[];
}

export function TagInput({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	placeholder = "Type to search or create tags...",
	selectedTags,
}: TagInputProps) {
	return (
		<TagPickerBase
			availableTags={availableTags}
			onAdd={onAdd}
			onCreateTag={onCreateTag}
			onRemove={onRemove}
			placeholder={placeholder}
			renderSelectedTag={(tag, handleRemove) => (
				<Badge className="gap-1 pr-1" variant="outline">
					{tag.name}
					<button
						aria-label={`Remove tag ${tag.name}`}
						className="text-muted-foreground hover:text-foreground"
						onClick={handleRemove}
						type="button"
					>
						<IconX size={10} />
					</button>
				</Badge>
			)}
			renderSuggestion={(tag) => tag.name}
			searchAriaLabel="Search tags"
			selectedTags={selectedTags}
		/>
	);
}
