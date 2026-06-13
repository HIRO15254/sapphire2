import { PlayerForm } from "@/features/players/components/player-form";
import { Button } from "@/shared/components/ui/button";
import { useOccupiedSeatEditor } from "./use-occupied-seat-editor";

interface OccupiedSeatEditorProps {
	onRemove: () => void;
	onSaved: () => void;
	playerId: string;
}

/**
 * Inline editor for an occupied seat — edits the player's name / memo / tags
 * and leaves the table, all without a modal. Reuses the shared `PlayerForm`;
 * the Save button submits it via the HTML `form` attribute.
 */
export function OccupiedSeatEditor({
	onRemove,
	onSaved,
	playerId,
}: OccupiedSeatEditorProps) {
	const { availableTags, createTag, isSaving, onSubmit, player } =
		useOccupiedSeatEditor({ onSaved, playerId });

	const formId = `seat-edit-${playerId}`;

	return (
		<div className="flex flex-col gap-3">
			<PlayerForm
				availableTags={availableTags}
				defaultMemo={player?.memo}
				defaultTags={player?.tags ?? []}
				defaultValues={{ name: player?.name ?? "" }}
				formId={formId}
				key={playerId}
				onCreateTag={createTag}
				onSubmit={onSubmit}
			/>
			<div className="flex items-center gap-2">
				<Button disabled={isSaving} form={formId} size="sm" type="submit">
					Save
				</Button>
				<Button
					className="border-destructive text-destructive hover:bg-destructive/10"
					onClick={onRemove}
					size="sm"
					type="button"
					variant="outline"
				>
					Leave seat
				</Button>
			</div>
		</div>
	);
}
