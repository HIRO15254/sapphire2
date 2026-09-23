import { IconPlus, IconTag, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TagPickerBase } from "@/shared/components/ui/tag-picker-base";
import { CRYST_FOCUS_RING, CRYST_TAG, CRYST_TAG_DOT } from "../cryst-controls";

export interface TagInputTag {
	color?: string | null;
	id: string;
	name: string;
}

interface TagInputProps<TTag extends TagInputTag> {
	availableTags: readonly TTag[];
	onAdd: (tag: TTag) => void;
	onCreateTag: (name: string) => Promise<TTag>;
	onRemove: (tag: TTag) => void;
	searchLabel: string;
	selectedTags: readonly TTag[];
}

const FALLBACK_COLOR = "var(--muted-foreground)";

function tagColor(tag: TagInputTag): string {
	return tag.color ?? FALLBACK_COLOR;
}

export function TagInput<TTag extends TagInputTag>({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	searchLabel,
	selectedTags,
}: TagInputProps<TTag>) {
	return (
		<TagPickerBase
			availableTags={[...availableTags]}
			containerClassName="shrink-0"
			emptyText="No tag matches"
			leadingIcon={
				<IconTag className="shrink-0 text-muted-foreground" size={16} />
			}
			onAdd={onAdd}
			onCreateTag={onCreateTag}
			onRemove={onRemove}
			renderCreateOption={(name) => (
				<>
					<IconPlus className="shrink-0 text-muted-foreground" size={14} />
					<span className="min-w-0 truncate">Create "{name}"</span>
				</>
			)}
			renderSelectedTag={(tag, handleRemove) => (
				<span className={CRYST_TAG}>
					<span
						className={CRYST_TAG_DOT}
						style={{ backgroundColor: tagColor(tag) }}
					/>
					{tag.name}
					<button
						aria-label={`Remove tag ${tag.name}`}
						className={cn(
							"-mr-0.5 ml-px inline-flex rounded-sm text-muted-foreground hover:text-foreground",
							CRYST_FOCUS_RING
						)}
						onClick={handleRemove}
						type="button"
					>
						<IconX size={12} />
					</button>
				</span>
			)}
			renderSuggestion={(tag) => (
				<>
					<span
						className={CRYST_TAG_DOT}
						style={{ backgroundColor: tagColor(tag) }}
					/>
					<span className="min-w-0 truncate">{tag.name}</span>
				</>
			)}
			searchAriaLabel={searchLabel}
			selectedTags={[...selectedTags]}
			variant="inline"
		/>
	);
}
