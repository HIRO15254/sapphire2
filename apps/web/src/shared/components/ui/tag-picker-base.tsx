import type * as React from "react";
import { useEffect, useRef, useState } from "react";
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
	placeholder: string;
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
	placeholder,
	renderSelectedTag,
	renderSuggestion,
	searchAriaLabel,
	selectedTags,
}: TagPickerBaseProps<TTag>) {
	const [inputValue, setInputValue] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [contentWidth, setContentWidth] = useState<number>();
	const anchorRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const normalizedInput = inputValue.trim();
	const allTags = availableTags ?? [];
	const selectedTagIds = new Set(selectedTags.map((tag) => tag.id));
	const filteredTags = allTags.filter((tag) => {
		if (selectedTagIds.has(tag.id)) {
			return false;
		}
		if (!normalizedInput) {
			return true;
		}
		return tag.name.toLowerCase().includes(normalizedInput.toLowerCase());
	});
	const matchingTag = allTags.find(
		(tag) => tag.name.toLowerCase() === normalizedInput.toLowerCase()
	);
	const canCreate = Boolean(onCreateTag && normalizedInput && !matchingTag);
	const shouldRenderPopover =
		isOpen && (allTags.length > 0 || Boolean(normalizedInput));

	useEffect(() => {
		if (!(shouldRenderPopover && anchorRef.current)) {
			return;
		}
		setContentWidth(anchorRef.current.offsetWidth);
	}, [shouldRenderPopover]);

	const focusInput = () => {
		inputRef.current?.focus();
	};

	const closeAndReset = () => {
		setInputValue("");
		setIsOpen(false);
	};

	const handleTagSelect = (tag: TTag) => {
		onAdd(tag);
		closeAndReset();
		focusInput();
	};

	const handleInputSubmit = async () => {
		if (!normalizedInput) {
			return;
		}

		if (matchingTag) {
			if (!selectedTagIds.has(matchingTag.id)) {
				handleTagSelect(matchingTag);
			}
			return;
		}

		if (!onCreateTag) {
			return;
		}

		const createdTag = await onCreateTag(normalizedInput);
		handleTagSelect(createdTag);
	};

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
				onOpenChange={setIsOpen}
				open={shouldRenderPopover}
			>
				<PopoverAnchor asChild>
					<div ref={anchorRef}>
						<Input
							aria-expanded={shouldRenderPopover}
							aria-label={searchAriaLabel}
							autoComplete="off"
							onChange={(event) => {
								setInputValue(event.target.value);
								setIsOpen(true);
							}}
							onFocus={() => setIsOpen(true)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									handleInputSubmit().catch(() => undefined);
								}
								if (event.key === "Escape") {
									setIsOpen(false);
								}
							}}
							placeholder={placeholder}
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
