import { IconPlus, IconTag, IconX } from "@tabler/icons-react";
import { TagPickerBase } from "@/shared/components/ui/tag-picker-base";

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

const FALLBACK_COLOR = "var(--primary)";

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
				<IconTag className="shrink-0 text-muted-foreground" size={13} />
			}
			onAdd={onAdd}
			onCreateTag={onCreateTag}
			onRemove={onRemove}
			renderCreateOption={(name) => (
				<>
					<IconPlus size={13} />
					<span className="min-w-0 truncate font-semibold">
						Create "{name}"
					</span>
				</>
			)}
			renderSelectedTag={(tag, handleRemove) => (
				<span
					className="inline-flex items-center gap-1 rounded-full py-[3px] pr-1.5 pl-2 font-semibold text-[11px]"
					style={{
						backgroundColor: `color-mix(in oklab, ${tagColor(tag)} 18%, transparent)`,
						color: tagColor(tag),
					}}
				>
					{tag.name}
					<button
						aria-label={`Remove tag ${tag.name}`}
						className="inline-flex size-3.5 items-center justify-center rounded-full opacity-65"
						onClick={handleRemove}
						type="button"
					>
						<IconX size={11} />
					</button>
				</span>
			)}
			renderSuggestion={(tag) => (
				<>
					<span
						className="size-[7px] shrink-0 rounded-full"
						style={{ backgroundColor: tagColor(tag) }}
					/>
					{tag.name}
					<span className="flex-1" />
					<IconPlus className="text-muted-foreground" size={13} />
				</>
			)}
			searchAriaLabel={searchLabel}
			selectedTags={[...selectedTags]}
			variant="inline"
		/>
	);
}
