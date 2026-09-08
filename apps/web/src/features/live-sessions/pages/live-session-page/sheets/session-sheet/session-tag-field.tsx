import { IconTag, IconTags, IconX } from "@tabler/icons-react";
import type { SessionTagLike } from "@/features/live-sessions/utils/session-settings";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";

export interface SessionTagFieldProps {
	candidates: readonly SessionTagLike[];
	isListOpen: boolean;
	onAdd: (name: string) => void;
	onCloseList: () => void;
	onOpenList: () => void;
	onQueryChange: (value: string) => void;
	onRemove: (tagId: string) => void;
	query: string;
	tags: readonly { id: string; name: string }[];
}

export function SessionTagField({
	candidates,
	isListOpen,
	onAdd,
	onCloseList,
	onOpenList,
	onQueryChange,
	onRemove,
	query,
	tags,
}: SessionTagFieldProps) {
	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			onAdd(candidates.at(0)?.name ?? query);
			return;
		}
		if (event.key === "Escape") {
			onCloseList();
		}
	};

	return (
		<div className="relative">
			<div className="mb-1.5 font-medium text-[length:var(--text-sm)]">
				Session tags
			</div>
			<div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5">
				<IconTags className="shrink-0 text-muted-foreground" size={14} />
				{tags.map((tag) => (
					<span
						className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] py-[3px] pr-1.5 pl-2 font-semibold text-[11px] text-primary"
						key={tag.id}
					>
						{tag.name}
						<button
							aria-label={`Remove ${tag.name}`}
							className="inline-flex size-3.5 items-center justify-center rounded-full opacity-65 hover:opacity-100"
							onClick={() => onRemove(tag.id)}
							type="button"
						>
							<IconX size={11} />
						</button>
					</span>
				))}
				<input
					aria-label="Add session tag"
					{...NO_INPUT_SUGGESTIONS}
					className="h-6 min-w-20 flex-1 bg-transparent px-0.5 text-[length:var(--text-xs)] outline-none"
					onChange={(e) => onQueryChange(e.target.value)}
					onFocus={onOpenList}
					onKeyDown={handleKeyDown}
					placeholder={tags.length > 0 ? "Add tag…" : "Add session tags…"}
					type="text"
					value={query}
				/>
			</div>
			{isListOpen ? (
				<div className="absolute inset-x-0 top-[calc(100%+4px)] z-[5] max-h-40 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[var(--shadow-md)]">
					{candidates.map((tag) => (
						<button
							className="flex h-[30px] w-full items-center gap-[7px] rounded-sm px-2 text-left text-[length:var(--text-xs)] hover:bg-accent"
							key={tag.id}
							onClick={() => onAdd(tag.name)}
							type="button"
						>
							<IconTag className="text-muted-foreground" size={13} />
							{tag.name}
							<span className="flex-1" />
							<span className="font-mono text-[11px] text-muted-foreground">
								{tag.usageCount}
							</span>
						</button>
					))}
					{candidates.length === 0 ? (
						<div className="p-2 text-[length:var(--text-xs)] text-muted-foreground">
							No match — press Enter to create
						</div>
					) : null}
				</div>
			) : null}
		</div>
	);
}
