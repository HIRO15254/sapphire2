import { IconLogout, IconUserSearch } from "@tabler/icons-react";
import { Input } from "@/shared/components/ui/input";
import { RichTextEditor } from "@/shared/components/ui/rich-text-editor";
import { TagField } from "./tag-field";
import type { PlayerPanelSelection } from "./use-player-panel";
import { usePlayerPanel } from "./use-player-panel";

export type { PlayerPanelSelection } from "./use-player-panel";

export interface PlayerPanelProps {
	isPaused: boolean;
	onLeave: (selection: PlayerPanelSelection) => void;
	selection: PlayerPanelSelection | null;
}

type PlayerPanelBodyProps = ReturnType<typeof usePlayerPanel> & {
	isPaused: boolean;
	selection: PlayerPanelSelection | null;
};

export function PlayerPanel({
	isPaused,
	onLeave,
	selection,
}: PlayerPanelProps) {
	const {
		availableTags,
		createTag,
		dotColor,
		isSaving,
		onAddTag,
		onLeaveClick,
		onMemoBlur,
		onMemoChange,
		onMemoContainerBlur,
		onNameBlur,
		onRemoveTag,
		player,
		seatLabel,
	} = usePlayerPanel({ onLeave, selection });

	return (
		<div className="flex h-full min-h-16 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
			{renderPlayerPanelBody({
				availableTags,
				createTag,
				dotColor,
				isPaused,
				isSaving,
				onAddTag,
				onLeaveClick,
				onMemoBlur,
				onMemoChange,
				onMemoContainerBlur,
				onNameBlur,
				onRemoveTag,
				player,
				seatLabel,
				selection,
			})}
		</div>
	);
}

function renderPlayerPanelBody({
	availableTags,
	createTag,
	dotColor,
	isPaused,
	onAddTag,
	onLeaveClick,
	onMemoChange,
	onMemoContainerBlur,
	onNameBlur,
	onRemoveTag,
	player,
	seatLabel,
	selection,
}: PlayerPanelBodyProps) {
	if (!selection) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground">
				<IconUserSearch size={20} />
				<span className="text-pretty text-[var(--m-text-footnote)]">
					Tap a seated player to edit their profile here
				</span>
			</div>
		);
	}

	if (!player) {
		return (
			<p className="px-3 py-2 text-muted-foreground text-sm">Loading...</p>
		);
	}

	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-2 px-3 pt-2.5 pb-3"
			key={player.id}
		>
			<div className="flex shrink-0 items-center gap-2">
				<span
					className="size-2 shrink-0 rounded-full"
					style={{ backgroundColor: dotColor }}
				/>
				<span className="shrink-0 font-mono text-muted-foreground text-xs">
					{seatLabel}
				</span>
				<Input
					aria-label="Player name"
					className="-mx-1.5 h-7 min-w-0 flex-1 rounded-md border-transparent bg-transparent px-1.5 font-semibold text-[var(--m-text-body)] hover:bg-muted focus-visible:border-input focus-visible:bg-card focus-visible:ring-0"
					defaultValue={player.name}
					onBlur={(e) => onNameBlur(e.target.value)}
					placeholder="Player name"
				/>
				<button
					className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-transparent px-2 text-destructive text-xs hover:bg-destructive/12 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isPaused}
					onClick={onLeaveClick}
					title="Log leaving and clear the seat"
					type="button"
				>
					<IconLogout size={13} />
					Leave
				</button>
			</div>

			<TagField
				availableTags={availableTags}
				onAdd={onAddTag}
				onCreateTag={createTag}
				onRemove={onRemoveTag}
				selectedTags={player.tags}
			/>

			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: blur-based auto-save wrapper */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: blur-based auto-save wrapper */}
			<div
				className="min-h-0 flex-1 overflow-y-auto"
				onBlur={onMemoContainerBlur}
			>
				<RichTextEditor
					initialContent={player.memo ?? undefined}
					onChange={onMemoChange}
				/>
			</div>
		</div>
	);
}
