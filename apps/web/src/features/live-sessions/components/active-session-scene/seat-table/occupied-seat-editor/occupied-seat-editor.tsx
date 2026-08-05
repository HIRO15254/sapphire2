import { IconLoader2 } from "@tabler/icons-react";
import { PlayerTagInput } from "@/features/players/components/player-tag-input";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";
import { useOccupiedSeatEditor } from "./use-occupied-seat-editor";

interface OccupiedSeatEditorProps {
	playerId: string;
}

/**
 * Speed-first inline editor for an occupied seat: tags use the shared tag
 * picker (matching the Players form), name and memo auto-save when focus leaves
 * the field. There is no Save button — every change is written optimistically
 * as it happens.
 */
export function OccupiedSeatEditor({ playerId }: OccupiedSeatEditorProps) {
	const {
		availableTags,
		createTag,
		isSaving,
		onAddTag,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onRemoveTag,
		player,
	} = useOccupiedSeatEditor({ playerId });

	if (!player) {
		return (
			<p className="px-1 py-2 text-muted-foreground text-sm">Loading...</p>
		);
	}

	return (
		<div className="flex flex-col gap-3" key={player.id}>
			<div className="flex items-center gap-2">
				<Input
					aria-label="Player name"
					className="h-8"
					defaultValue={player.name}
					onBlur={(e) => onNameBlur(e.target.value)}
				/>
				{isSaving ? (
					<IconLoader2
						aria-label="Saving"
						className="shrink-0 animate-spin text-muted-foreground"
						size={16}
					/>
				) : null}
			</div>

			<PlayerTagInput
				availableTags={availableTags}
				onAdd={onAddTag}
				onCreateTag={createTag}
				onRemove={onRemoveTag}
				selectedTags={player.tags}
			/>

			{/* Blur capture (focusout) for auto-save, not a pointer/keyboard interaction —
			    the editable surface inside RichTextEditor stays fully interactive. */}
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: blur-based auto-save wrapper */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: blur-based auto-save wrapper */}
			<div onBlur={onMemoContainerBlur}>
				<RichTextEditor
					initialContent={player.memo ?? undefined}
					onChange={onMemoChange}
				/>
			</div>
		</div>
	);
}
