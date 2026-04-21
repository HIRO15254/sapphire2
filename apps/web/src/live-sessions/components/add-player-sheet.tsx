import { IconPlus, IconSearch, IconUserQuestion } from "@tabler/icons-react";
import { useAddPlayerSearch } from "@/live-sessions/hooks/use-add-player-search";
import { ColorBadge } from "@/players/components/color-badge";
import { PlayerAvatar } from "@/players/components/player-avatar";
import { PlayerTagInput } from "@/players/components/player-tag-input";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Input } from "@/shared/components/ui/input";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface AddPlayerSheetProps {
	availableTags: TagWithColor[];
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: {
		memo?: string | null;
		name: string;
		tagIds?: string[];
	}) => void;
	onAddTemporary: () => void;
	onCreateTag: (name: string) => Promise<TagWithColor>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

export function AddPlayerSheet({
	availableTags,
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
	onCreateTag,
	onOpenChange,
	open,
}: AddPlayerSheetProps) {
	const {
		search,
		setSearch,
		selectedTags,
		selectedTagIds,
		addSelectedTag,
		removeSelectedTag,
		filteredPlayers,
	} = useAddPlayerSearch({ excludePlayerIds, open });

	const handleAddExisting = (playerId: string, playerName: string) => {
		onAddExisting(playerId, playerName);
		onOpenChange(false);
	};

	const handleCreateNew = () => {
		const trimmed = search.trim();
		if (!trimmed) {
			return;
		}
		onAddNew({
			name: trimmed,
			tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
		});
		onOpenChange(false);
	};

	const handleAddTemporary = () => {
		onAddTemporary();
		onOpenChange(false);
	};

	return (
		<ResponsiveDialog
			fullHeight
			onOpenChange={onOpenChange}
			open={open}
			title="Add Player"
		>
			<div className="flex flex-col gap-3">
				<div className="relative">
					<IconSearch
						className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						size={16}
					/>
					<Input
						aria-label="Search players"
						className="pl-9"
						id="add-player-search"
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search players..."
						value={search}
					/>
				</div>

				<PlayerTagInput
					availableTags={availableTags}
					onAdd={addSelectedTag}
					onCreateTag={onCreateTag}
					onRemove={removeSelectedTag}
					placeholder="Filter by tags..."
					selectedTags={selectedTags}
				/>

				<Button
					className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left"
					onClick={handleAddTemporary}
					type="button"
					variant="ghost"
				>
					<div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 border-dashed text-muted-foreground">
						<IconUserQuestion size={16} />
					</div>
					<p className="font-medium text-sm">Add Temporary Player</p>
				</Button>

				<div className="max-h-[40vh] overflow-y-auto">
					{search.trim() && (
						<Button
							className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left"
							onClick={handleCreateNew}
							type="button"
							variant="ghost"
						>
							<div className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 border-dashed text-muted-foreground">
								<IconPlus size={16} />
							</div>
							<p className="font-medium text-sm">
								Create &quot;{search.trim()}&quot;
							</p>
						</Button>
					)}
					{filteredPlayers.map((p) => (
						<Button
							className="h-auto w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-left"
							key={p.id}
							onClick={() => handleAddExisting(p.id, p.name)}
							type="button"
							variant="ghost"
						>
							<PlayerAvatar className="shrink-0" />
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{p.name}</p>
								{p.tags.length > 0 && (
									<div className="mt-0.5 flex flex-wrap gap-1">
										{p.tags.map((tag) => (
											<ColorBadge color={tag.color} key={tag.id}>
												{tag.name}
											</ColorBadge>
										))}
									</div>
								)}
								{p.memo && (
									<p className="truncate text-muted-foreground text-xs">
										{p.memo}
									</p>
								)}
							</div>
							<IconPlus className="shrink-0 text-muted-foreground" size={16} />
						</Button>
					))}
					{filteredPlayers.length === 0 &&
						!search.trim() &&
						selectedTagIds.length === 0 && (
							<EmptyState
								className="border-none bg-transparent px-0 py-4"
								heading="No available players"
							/>
						)}
				</div>
			</div>
		</ResponsiveDialog>
	);
}
