import { IconPlus, IconSearch, IconUserQuestion } from "@tabler/icons-react";
import { PlayerTagInput } from "@/features/players/components/player-tag-input";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useEmptySeatEditor } from "./use-empty-seat-editor";

interface TagWithColor {
	color: string;
	id: string;
	name: string;
}

interface EmptySeatEditorProps {
	availableTags: TagWithColor[];
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string; tagIds?: string[] }) => void;
	onAddTemporary: () => void;
	onCreateTag: (name: string) => Promise<TagWithColor>;
}

/**
 * Inline seating editor for an empty seat — search an existing player, create a
 * new one, or seat a temporary player, all without a modal. Reuses the
 * add-player search hook; the seat is supplied by the parent via the callbacks.
 */
export function EmptySeatEditor({
	availableTags,
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
	onCreateTag,
}: EmptySeatEditorProps) {
	const {
		addSelectedTag,
		filteredPlayers,
		handleAddExisting,
		handleCreateNew,
		removeSelectedTag,
		search,
		selectedTags,
		setSearch,
	} = useEmptySeatEditor({ excludePlayerIds, onAddExisting, onAddNew });

	const trimmed = search.trim();

	return (
		<div className="flex flex-col gap-3">
			<div className="relative">
				<IconSearch
					className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
					size={16}
				/>
				<Input
					aria-label="Search players"
					className="pl-9"
					onChange={(e) => setSearch(e.target.value)}
					value={search}
				/>
			</div>

			<PlayerTagInput
				availableTags={availableTags}
				onAdd={addSelectedTag}
				onCreateTag={onCreateTag}
				onRemove={removeSelectedTag}
				selectedTags={selectedTags}
			/>

			<Button
				className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
				onClick={onAddTemporary}
				type="button"
				variant="ghost"
			>
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 border-dashed text-muted-foreground">
					<IconUserQuestion size={16} />
				</span>
				<span className="font-medium text-sm">Add temporary player</span>
			</Button>

			{trimmed ? (
				<Button
					className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
					onClick={handleCreateNew}
					type="button"
					variant="ghost"
				>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 border-dashed text-muted-foreground">
						<IconPlus size={16} />
					</span>
					<span className="font-medium text-sm">Create "{trimmed}"</span>
				</Button>
			) : null}

			{filteredPlayers.length === 0 && trimmed === "" ? (
				<p className="px-3 py-2 text-muted-foreground text-sm">
					No available players
				</p>
			) : (
				<ul className="flex flex-col">
					{filteredPlayers.map((p) => (
						<li key={p.id}>
							<button
								className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
								onClick={() => handleAddExisting(p.id, p.name)}
								type="button"
							>
								<Avatar size="sm">
									<AvatarFallback>
										{p.name.slice(0, 1).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="min-w-0 flex-1">
									<span className="truncate font-medium text-sm">{p.name}</span>
									{p.tags.length > 0 ? (
										<span className="mt-0.5 flex flex-wrap gap-1">
											{p.tags.map((tag) => (
												<Badge
													key={tag.id}
													style={{ borderColor: tag.color, color: tag.color }}
													variant="outline"
												>
													{tag.name}
												</Badge>
											))}
										</span>
									) : null}
								</span>
								<IconPlus
									className="shrink-0 text-muted-foreground"
									size={16}
								/>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
