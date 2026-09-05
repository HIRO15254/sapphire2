import { IconPlus, IconTag, IconX } from "@tabler/icons-react";
import {
	TAG_COLORS,
	type TagColor,
} from "@/features/players/constants/player-tag-colors";
import type { PlayerTagWithColor } from "@/features/players/hooks/use-player-detail";
import { tagBadgeClassName } from "@/features/players/utils/tag-badge-class-name";
import { cn } from "@/lib/utils";
import { useTagField } from "./use-tag-field";

export interface TagFieldProps {
	availableTags?: PlayerTagWithColor[];
	onAdd: (tag: PlayerTagWithColor) => void;
	onCreateTag?: (name: string) => Promise<PlayerTagWithColor>;
	onRemove: (tag: PlayerTagWithColor) => void;
	selectedTags: PlayerTagWithColor[];
}

function tagSwatchClassName(color: string) {
	return TAG_COLORS[color as TagColor]?.swatch ?? TAG_COLORS.gray.swatch;
}

function TagPill({
	onRemove,
	tag,
}: {
	onRemove: () => void;
	tag: PlayerTagWithColor;
}) {
	return (
		<span
			className={tagBadgeClassName(
				tag.color,
				"inline-flex items-center gap-1 rounded-full py-[3px] pr-1.5 pl-2 font-semibold text-[11px]"
			)}
		>
			{tag.name}
			<button
				aria-label={`Remove tag ${tag.name}`}
				className="flex size-3.5 items-center justify-center rounded-full border-none bg-transparent p-0 text-inherit opacity-65 hover:opacity-100"
				onClick={onRemove}
				type="button"
			>
				<IconX size={11} />
			</button>
		</span>
	);
}

export function TagField({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	selectedTags,
}: TagFieldProps) {
	const {
		inputValue,
		isOpen,
		onFocus,
		onKeyDown,
		onQueryChange,
		onSelectSuggestion,
		placeholder,
		suggestions,
	} = useTagField({
		availableTags,
		onAdd,
		onCreateTag,
		onRemove,
		selectedTags,
	});

	return (
		<div className="relative shrink-0">
			<div className="flex min-h-8 flex-wrap items-center gap-[5px] rounded-md border border-input bg-card px-1.5 py-1">
				<IconTag className="shrink-0 text-muted-foreground" size={13} />
				{selectedTags.map((tag) => (
					<TagPill key={tag.id} onRemove={() => onRemove(tag)} tag={tag} />
				))}
				<input
					aria-label="Add a tag"
					className="h-6 min-w-[72px] flex-1 border-none bg-transparent px-0.5 text-foreground text-xs outline-none placeholder:text-muted-foreground"
					onChange={(e) => onQueryChange(e.target.value)}
					onFocus={onFocus}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					value={inputValue}
				/>
			</div>
			{isOpen ? (
				<div className="absolute inset-x-0 top-[calc(100%+4px)] z-10 max-h-[168px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[var(--shadow-popover)]">
					{suggestions.map((tag) => (
						<button
							className="flex h-[30px] w-full items-center gap-[7px] rounded-sm px-2 text-left text-foreground text-xs hover:bg-accent"
							key={tag.id}
							onClick={() => onSelectSuggestion(tag)}
							type="button"
						>
							<span
								className={cn(
									"size-[7px] shrink-0 rounded-full",
									tagSwatchClassName(tag.color)
								)}
							/>
							{tag.name}
							<span className="flex-1" />
							<IconPlus className="text-muted-foreground" size={13} />
						</button>
					))}
					{suggestions.length === 0 ? (
						<div className="p-2 text-muted-foreground text-xs">
							No match — press Enter to create
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
