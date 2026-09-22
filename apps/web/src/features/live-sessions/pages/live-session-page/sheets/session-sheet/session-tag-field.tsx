import { IconTag, IconTags, IconX } from "@tabler/icons-react";
import type { SessionTagLike } from "@/features/live-sessions/utils/session-settings";
import { TagPickerBase } from "@/shared/components/ui/tag-picker-base";

export interface SessionTagFieldProps {
	availableTags: readonly SessionTagLike[];
	onAdd: (tag: SessionTagLike) => void;
	onCreateTag: (name: string) => Promise<SessionTagLike>;
	onRemove: (tag: SessionTagLike) => void;
	selectedTags: readonly SessionTagLike[];
}

export function SessionTagField({
	availableTags,
	onAdd,
	onCreateTag,
	onRemove,
	selectedTags,
}: SessionTagFieldProps) {
	return (
		<div>
			<div className="mb-1.5 font-medium text-[length:var(--text-sm)]">
				Session tags
			</div>
			<TagPickerBase
				availableTags={[...availableTags]}
				emptyText="No matching tags."
				leadingIcon={
					<IconTags className="shrink-0 text-muted-foreground" size={14} />
				}
				onAdd={onAdd}
				onCreateTag={onCreateTag}
				onRemove={onRemove}
				renderSelectedTag={(tag, handleRemove) => (
					<span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] py-[3px] pr-1.5 pl-2 font-semibold text-[11px] text-primary">
						{tag.name}
						<button
							aria-label={`Remove ${tag.name}`}
							className="inline-flex size-3.5 items-center justify-center rounded-full opacity-65 hover:opacity-100"
							onClick={handleRemove}
							type="button"
						>
							<IconX size={11} />
						</button>
					</span>
				)}
				renderSuggestion={(tag) => (
					<>
						<IconTag className="text-muted-foreground" size={13} />
						{tag.name}
						<span className="flex-1" />
						<span className="font-mono text-[11px] text-muted-foreground">
							{tag.usageCount}
						</span>
					</>
				)}
				searchAriaLabel="Add session tag"
				selectedTags={[...selectedTags]}
				variant="inline"
			/>
		</div>
	);
}
