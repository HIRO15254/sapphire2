import type * as React from "react";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { Input } from "@/shared/components/ui/input";
import {
	Popover,
	PopoverAnchor,
	PopoverContent,
} from "@/shared/components/ui/popover";
import { useTagPickerBase } from "./use-tag-picker-base";

interface TagItemBase {
	id: string;
	name: string;
}

interface TagPickerBaseProps<TTag extends TagItemBase> {
	availableTags?: TTag[];
	emptyText?: string;
	onAdd: (tag: TTag) => void;
	onCreateTag?: (name: string) => Promise<TTag>;
	onRemove: (tag: TTag) => void;
	renderSelectedTag: (tag: TTag, onRemove: () => void) => React.ReactNode;
	renderSuggestion: (tag: TTag) => React.ReactNode;
	searchAriaLabel: string;
	selectedTags: TTag[];
}

export function TagPickerBase<TTag extends TagItemBase>({
	availableTags,
	emptyText = "No matching tags.",
	onAdd,
	onCreateTag,
	onRemove,
	renderSelectedTag,
	renderSuggestion,
	searchAriaLabel,
	selectedTags,
}: TagPickerBaseProps<TTag>) {
	const {
		anchorRef,
		canCreate,
		contentWidth,
		filteredTags,
		handleInputSubmit,
		handleTagSelect,
		inputRef,
		inputValue,
		normalizedInput,
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

	return (
		<div className="flex flex-col gap-2">
			{selectedTags.length > 0 ? (
				<div className="flex flex-wrap items-center gap-1">
					{selectedTags.map((tag) => (
						<div key={tag.id}>
							{renderSelectedTag(tag, () => onRemove(tag))}
						</div>
					))}
				</div>
			) : null}

			<Popover
				modal={false}
				onOpenChange={onOpenChange}
				open={shouldRenderPopover}
			>
				<PopoverAnchor asChild>
					<div ref={anchorRef}>
						<Input
							aria-expanded={shouldRenderPopover}
							aria-label={searchAriaLabel}
							autoComplete="off"
							onChange={(event) => {
								onInputChange(event.target.value);
								onOpenChange(true);
							}}
							onFocus={() => onOpenChange(true)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									handleInputSubmit().catch(() => undefined);
								}
								if (event.key === "Escape") {
									onOpenChange(false);
								}
							}}
							ref={inputRef}
							role="combobox"
							value={inputValue}
						/>
					</div>
				</PopoverAnchor>

				{shouldRenderPopover ? (
					<PopoverContent
						align="start"
						className="p-0"
						onOpenAutoFocus={(event) => event.preventDefault()}
						style={contentWidth ? { width: contentWidth } : undefined}
					>
						<Command shouldFilter={false}>
							<CommandList>
								{filteredTags.length === 0 && !canCreate ? (
									<CommandEmpty>{emptyText}</CommandEmpty>
								) : null}
								{filteredTags.map((tag) => (
									<CommandItem
										key={tag.id}
										onMouseDown={(event) => event.preventDefault()}
										onSelect={() => handleTagSelect(tag)}
										value={tag.name}
									>
										{renderSuggestion(tag)}
									</CommandItem>
								))}
								{canCreate ? (
									<CommandItem
										onMouseDown={(event) => event.preventDefault()}
										onSelect={() => {
											handleInputSubmit().catch(() => undefined);
										}}
										value={`create-${normalizedInput}`}
									>
										Create &quot;{normalizedInput}&quot;
									</CommandItem>
								) : null}
							</CommandList>
						</Command>
					</PopoverContent>
				) : null}
			</Popover>
		</div>
	);
}
