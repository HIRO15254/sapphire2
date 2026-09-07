import { IconLogout, IconPlus, IconTag, IconX } from "@tabler/icons-react";
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
			<div className="flex h-full min-h-16 items-center justify-center p-4 text-[length:var(--m-text-footnote)] text-muted-foreground">
				Loading player...
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

			<div className="relative shrink-0">
				<div className="flex min-h-8 flex-wrap items-center gap-[5px] rounded-md border border-input bg-card px-1.5 py-1">
					<IconTag className="shrink-0 text-muted-foreground" size={13} />
					{panel.selectedTags.map((tag) => (
						<span
							className="inline-flex items-center gap-1 rounded-full py-[3px] pr-1.5 pl-2 font-semibold text-[11px]"
							key={tag.id}
							style={{
								backgroundColor: `color-mix(in oklab, ${tag.color} 18%, transparent)`,
								color: tag.color,
							}}
						>
							{tag.name}
							<button
								aria-label={`Remove tag ${tag.name}`}
								className="inline-flex size-3.5 items-center justify-center rounded-full opacity-65"
								onClick={() => panel.onRemoveTag(tag)}
								type="button"
							>
								<IconX size={11} />
							</button>
						</span>
					))}
					<input
						aria-label="Add labels"
						className="h-6 min-w-[72px] flex-1 border-none bg-transparent px-0.5 text-[length:var(--text-xs)] outline-none"
						onChange={(e) => panel.onTagQueryChange(e.target.value)}
						onFocus={panel.onOpenTagList}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								panel.onSubmitTagQuery();
							}
							if (e.key === "Escape") {
								panel.onCloseTagList();
							}
						}}
						type="text"
						value={panel.tagQuery}
					/>
				</div>
				{panel.isTagListOpen ? (
					<div className="absolute inset-x-0 top-[calc(100%+4px)] z-[5] max-h-[168px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[var(--shadow-popover)]">
						{panel.tagChoices.length === 0 ? (
							<p className="p-2 text-[length:var(--text-xs)] text-muted-foreground">
								No match — press Enter to create
							</p>
						) : (
							panel.tagChoices.map((tag) => (
								<button
									className="flex h-[30px] w-full items-center gap-[7px] rounded-sm px-2 text-left text-[length:var(--text-xs)]"
									key={tag.id}
									onClick={() => panel.onAddTag(tag)}
									type="button"
								>
									<span
										className="size-[7px] shrink-0 rounded-full"
										style={{ backgroundColor: tag.color }}
									/>
									{tag.name}
									<span className="flex-1" />
									<IconPlus className="text-muted-foreground" size={13} />
								</button>
							))
						)}
					</div>
				) : null}
			</div>

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
