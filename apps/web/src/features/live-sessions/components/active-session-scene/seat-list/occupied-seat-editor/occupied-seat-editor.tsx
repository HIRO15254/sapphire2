import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";
import { useOccupiedSeatEditor } from "./use-occupied-seat-editor";

interface OccupiedSeatEditorProps {
	playerId: string;
}

/**
 * Speed-first inline editor for an occupied seat: tag chips toggle and save on
 * a single tap, name and memo auto-save when focus leaves the field. There is
 * no Save button — every change is written optimistically as it happens.
 */
export function OccupiedSeatEditor({ playerId }: OccupiedSeatEditorProps) {
	const {
		availableTags,
		isSaving,
		isTagSelected,
		newTagName,
		onCreateTag,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onToggleTag,
		player,
		setNewTagName,
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

			<div className="flex flex-wrap items-center gap-1.5">
				{availableTags.map((tag) => {
					const selected = isTagSelected(tag.id);
					return (
						<button
							aria-pressed={selected}
							className={cn(
								"rounded-full border px-2.5 py-1 font-medium text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
								!selected && "opacity-60"
							)}
							key={tag.id}
							onClick={() => onToggleTag(tag.id)}
							style={
								selected
									? {
											backgroundColor: tag.color,
											borderColor: tag.color,
											color: "white",
										}
									: { borderColor: tag.color, color: tag.color }
							}
							type="button"
						>
							{tag.name}
						</button>
					);
				})}
				<span className="flex items-center gap-1">
					<Input
						aria-label="New tag name"
						className="h-7 w-24 text-xs"
						onChange={(e) => setNewTagName(e.target.value)}
						value={newTagName}
					/>
					<Button
						aria-label="Create tag"
						onClick={onCreateTag}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						<IconPlus size={14} />
					</Button>
				</span>
			</div>

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
