import { IconX } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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

function TagSuggestions({
	tags,
	selectedTagIds,
	input,
	onSelect,
	onCreateTag,
}: {
	input: string;
	onCreateTag: (name: string) => void;
	onSelect: (tag: Tag) => void;
	selectedTagIds: Set<string>;
	tags: Tag[];
}) {
	const filtered = tags.filter(
		(t) =>
			!selectedTagIds.has(t.id) &&
			t.name.toLowerCase().includes(input.toLowerCase())
	);
	const exactMatch = tags.some(
		(t) => t.name.toLowerCase() === input.trim().toLowerCase()
	);

	if (filtered.length === 0 && exactMatch) {
		return null;
	}

	return (
		<div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
			{filtered.map((tag) => (
				<button
					className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
					key={tag.id}
					onClick={() => onSelect(tag)}
					onMouseDown={(e) => e.preventDefault()}
					type="button"
				>
					{tag.name}
				</button>
			))}
			{!exactMatch && input.trim() && (
				<button
					className="w-full px-3 py-1.5 text-left text-muted-foreground text-sm hover:bg-accent"
					onClick={() => onCreateTag(input.trim())}
					onMouseDown={(e) => e.preventDefault()}
					type="button"
				>
					Create &quot;{input.trim()}&quot;
				</button>
			)}
		</div>
	);
}

export function TagInput({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	placeholder = "Type to search or create tags...",
	selectedTags,
}: TagInputProps) {
	const [input, setInput] = useState("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectedIds = new Set(selectedTags.map((t) => t.id));

	const handleAdd = async (name: string) => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}

		const existing = availableTags?.find(
			(t) =>
				t.name.toLowerCase() === trimmed.toLowerCase() &&
				!selectedIds.has(t.id)
		);

		if (existing) {
			onAdd(existing);
		} else if (onCreateTag) {
			const created = await onCreateTag(trimmed);
			onAdd(created);
		}

		setInput("");
		setShowSuggestions(false);
	};

	const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			await handleAdd(input);
		}
		if (e.key === "Escape") {
			setShowSuggestions(false);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			{selectedTags.length > 0 && (
				<div className="flex flex-wrap items-center gap-1">
					{selectedTags.map((tag) => (
						<Badge className="gap-1 pr-1" key={tag.id} variant="outline">
							{tag.name}
							<button
								aria-label={`Remove tag ${tag.name}`}
								className="text-muted-foreground hover:text-foreground"
								onClick={() => onRemove(tag)}
								type="button"
							>
								<IconX size={10} />
							</button>
						</Badge>
					))}
				</div>
			)}
			<div className="relative">
				<Input
					autoComplete="off"
					onChange={(e) => {
						setInput(e.target.value);
						setShowSuggestions(true);
					}}
					onFocus={() => setShowSuggestions(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					ref={inputRef}
					value={input}
				/>
				{showSuggestions && input.trim() && availableTags && (
					<TagSuggestions
						input={input}
						onCreateTag={async (name) => {
							await handleAdd(name);
						}}
						onSelect={(tag) => {
							onAdd(tag);
							setInput("");
							setShowSuggestions(false);
							inputRef.current?.focus();
						}}
						selectedTagIds={selectedIds}
						tags={availableTags}
					/>
				)}
			</div>
		</div>
	);
}
