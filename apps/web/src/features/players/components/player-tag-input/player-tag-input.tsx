import { IconX } from "@tabler/icons-react";
import { tagBadgeClassName } from "@/features/players/utils/tag-badge-class-name";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { TagPickerBase } from "@/shared/components/ui/tag-picker-base";

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
	selectedTags: TagWithColor[];
}

export function PlayerTagInput({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	selectedTags,
}: PlayerTagInputProps) {
	return (
		<TagPickerBase
			availableTags={availableTags}
			onAdd={onAdd}
			onCreateTag={onCreateTag}
			onRemove={onRemove}
			renderSelectedTag={(tag, handleRemove) => (
				<Badge className={tagBadgeClassName(tag.color, "gap-1 pr-1")}>
					{tag.name}
					<Button
						aria-label={`Remove tag ${tag.name}`}
						className="size-4 opacity-70 hover:opacity-100"
						onClick={handleRemove}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<IconX size={10} />
					</Button>
				</Badge>
			)}
			renderSuggestion={(tag) => (
				<Badge className={tagBadgeClassName(tag.color)}>{tag.name}</Badge>
			)}
			searchAriaLabel="Search player tags"
			selectedTags={selectedTags}
		/>
	);
}
