import {
	IconLoader2,
	IconLogout,
	IconPlus,
	IconTag,
	IconX,
} from "@tabler/icons-react";
import { TagPickerBase } from "@/shared/components/ui/tag-picker-base";
import { useSelectedPlayerPanel } from "./use-selected-player-panel";

interface SelectedPlayerPanelProps {
	onLeave: (playerId: string) => void;
	playerId: string;
	seatLabel: string;
}

const DOT_FALLBACK = "var(--muted-foreground)";

export function SelectedPlayerPanel({
	onLeave,
	playerId,
	seatLabel,
}: SelectedPlayerPanelProps) {
	const panel = useSelectedPlayerPanel({ onLeave, playerId });

	if (!panel.player) {
		return (
			<div className="flex h-full min-h-16 items-center justify-center p-4">
				<IconLoader2
					aria-label="Loading player"
					className="animate-spin text-muted-foreground"
					role="img"
					size={20}
				/>
			</div>
		);
	}

	const dot = panel.selectedTags[0]?.color ?? DOT_FALLBACK;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2.5 pb-3">
			<div className="flex shrink-0 items-center gap-2">
				<span
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: dot }}
				/>
				<span className="font-mono text-[length:var(--text-xs)] text-muted-foreground">
					{seatLabel}
				</span>
				<input
					aria-label="Player name"
					className="-mx-1.5 h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 font-semibold text-[length:var(--m-text-body)] outline-none focus-visible:border-input focus-visible:bg-card"
					defaultValue={panel.player.name}
					key={playerId}
					onBlur={(e) => panel.onNameCommit(e.target.value)}
					type="text"
				/>
				<button
					className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-transparent px-2 text-[length:var(--text-xs)] text-destructive"
					onClick={panel.onLeave}
					title="Log leaving and clear the seat"
					type="button"
				>
					<IconLogout size={13} />
					Leave
				</button>
			</div>

			<TagPickerBase
				availableTags={[...panel.availableTags]}
				containerClassName="shrink-0"
				emptyText="No label matches"
				leadingIcon={
					<IconTag className="shrink-0 text-muted-foreground" size={13} />
				}
				onAdd={panel.onAddTag}
				onCreateTag={panel.onCreateTag}
				onRemove={panel.onRemoveTag}
				renderCreateOption={(name) => (
					<>
						<IconPlus size={13} />
						<span className="min-w-0 truncate font-semibold">
							Create "{name}"
						</span>
					</>
				)}
				renderSelectedTag={(tag, handleRemove) => (
					<span
						className="inline-flex items-center gap-1 rounded-full py-[3px] pr-1.5 pl-2 font-semibold text-[11px]"
						style={{
							backgroundColor: `color-mix(in oklab, ${tag.color} 18%, transparent)`,
							color: tag.color,
						}}
					>
						{tag.name}
						<button
							aria-label={`Remove tag ${tag.name}`}
							className="inline-flex size-3.5 items-center justify-center rounded-full opacity-65"
							onClick={handleRemove}
							type="button"
						>
							<IconX size={11} />
						</button>
					</span>
				)}
				renderSuggestion={(tag) => (
					<>
						<span
							className="size-[7px] shrink-0 rounded-full"
							style={{ backgroundColor: tag.color }}
						/>
						{tag.name}
						<span className="flex-1" />
						<IconPlus className="text-muted-foreground" size={13} />
					</>
				)}
				searchAriaLabel="Add labels"
				selectedTags={[...panel.selectedTags]}
				variant="inline"
			/>

			<textarea
				aria-label="Notes on this player"
				className="min-h-14 w-full flex-1 resize-none rounded-md border border-input bg-card p-2 text-[length:var(--m-text-footnote)] leading-[var(--leading-relaxed)] outline-none focus-visible:border-ring"
				defaultValue={panel.notesText}
				key={playerId}
				onBlur={(e) => panel.onNotesCommit(e.target.value)}
			/>
		</div>
	);
}
