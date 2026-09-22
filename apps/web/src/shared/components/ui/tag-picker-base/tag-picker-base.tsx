import type * as React from "react";
import { cn } from "@/lib/utils";
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
	containerClassName?: string;
	emptyText?: string;
	leadingIcon?: React.ReactNode;
	onAdd: (tag: TTag) => void;
	onCreateTag?: (name: string) => Promise<TTag>;
	onRemove: (tag: TTag) => void;
	renderCreateOption?: (name: string) => React.ReactNode;
	renderSelectedTag: (tag: TTag, onRemove: () => void) => React.ReactNode;
	renderSuggestion: (tag: TTag) => React.ReactNode;
	searchAriaLabel: string;
	selectedTags: TTag[];
	variant?: "inline" | "popover";
}

const defaultRenderCreateOption = (name: string) => (
	<>Create &quot;{name}&quot;</>
);

export function TagPickerBase<TTag extends TagItemBase>({
	availableTags,
	containerClassName,
	emptyText = "No matching tags.",
	leadingIcon,
	onAdd,
	onCreateTag,
	onRemove,
	renderCreateOption = defaultRenderCreateOption,
	renderSelectedTag,
	renderSuggestion,
	searchAriaLabel,
	selectedTags,
	variant = "popover",
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

	const submitOnEnter = variant === "popover";

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" && submitOnEnter) {
			event.preventDefault();
			handleInputSubmit().catch(() => undefined);
			return;
		}
		if (event.key === "Escape") {
			onOpenChange(false);
		}
	};

	if (variant === "inline") {
		return (
			// biome-ignore lint/a11y/noNoninteractiveElementInteractions: blur-based dropdown close wrapper
			// biome-ignore lint/a11y/noStaticElementInteractions: blur-based dropdown close wrapper
			<div
				className={cn("relative", containerClassName)}
				onBlur={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget)) {
						onOpenChange(false);
					}
				}}
			>
				<div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5">
					{leadingIcon}
					{selectedTags.map((tag) => (
						<div key={tag.id}>
							{renderSelectedTag(tag, () => onRemove(tag))}
						</div>
					))}
					<input
						aria-expanded={shouldRenderPopover}
						aria-label={searchAriaLabel}
						autoComplete="off"
						className="h-6 min-w-20 flex-1 border-none bg-transparent px-0.5 text-[length:var(--text-xs)] outline-none"
						onChange={(event) => {
							onInputChange(event.target.value);
							onOpenChange(true);
						}}
						onFocus={() => onOpenChange(true)}
						onKeyDown={handleKeyDown}
						ref={inputRef}
						role="combobox"
						type="text"
						value={inputValue}
					/>
				</div>
				{shouldRenderPopover ? (
					<div className="absolute inset-x-0 top-[calc(100%+4px)] z-[5] max-h-40 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[var(--shadow-popover)]">
						{filteredTags.map((tag) => (
							<button
								className="flex h-[30px] w-full items-center gap-[7px] rounded-sm px-2 text-left text-[length:var(--text-xs)] hover:bg-accent"
								key={tag.id}
								onClick={() => handleTagSelect(tag)}
								onMouseDown={(event) => event.preventDefault()}
								type="button"
							>
								{renderSuggestion(tag)}
							</button>
						))}
						{canCreate ? (
							<button
								className="flex h-[30px] w-full items-center gap-[7px] rounded-sm px-2 text-left text-[length:var(--text-xs)] text-primary"
								onClick={() => handleInputSubmit().catch(() => undefined)}
								onMouseDown={(event) => event.preventDefault()}
								type="button"
							>
								{renderCreateOption(normalizedInput)}
							</button>
						) : null}
						{filteredTags.length === 0 && !canCreate ? (
							<p className="p-2 text-[length:var(--text-xs)] text-muted-foreground">
								{emptyText}
							</p>
						) : null}
					</div>
				) : null}
			</div>
		);
	}

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
							onKeyDown={handleKeyDown}
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
										{renderCreateOption(normalizedInput)}
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
