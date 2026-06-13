import { IconPlus, IconSearch, IconUserQuestion } from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useEmptySeatEditor } from "./use-empty-seat-editor";

interface EmptySeatEditorProps {
	excludePlayerIds: string[];
	onAddExisting: (playerId: string, playerName: string) => void;
	onAddNew: (values: { name: string }) => void;
	onAddTemporary: () => void;
}

/**
 * Speed-first inline seating for an empty seat: available players are listed
 * immediately (one tap to seat), with search to narrow, a one-tap temporary
 * player, and create-by-name. Tags/memo are edited after seating, inline on
 * the occupied row.
 */
export function EmptySeatEditor({
	excludePlayerIds,
	onAddExisting,
	onAddNew,
	onAddTemporary,
}: EmptySeatEditorProps) {
	const {
		filteredPlayers,
		handleAddExisting,
		handleCreateNew,
		search,
		setSearch,
	} = useEmptySeatEditor({ excludePlayerIds, onAddExisting, onAddNew });

	const trimmed = search.trim();

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2">
				<div className="relative flex-1">
					<IconSearch
						className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
						size={16}
					/>
					<Input
						aria-label="Search players"
						className="h-8 pl-9"
						onChange={(e) => setSearch(e.target.value)}
						value={search}
					/>
				</div>
				<Button
					className="h-8 shrink-0 gap-1.5"
					onClick={onAddTemporary}
					size="sm"
					type="button"
					variant="outline"
				>
					<IconUserQuestion size={14} />
					Temp
				</Button>
			</div>

			{trimmed ? (
				<Button
					className="h-8 w-full justify-start gap-2 px-2"
					onClick={handleCreateNew}
					size="sm"
					type="button"
					variant="ghost"
				>
					<IconPlus className="shrink-0 text-muted-foreground" size={14} />
					<span className="truncate font-medium text-sm">
						Create "{trimmed}"
					</span>
				</Button>
			) : null}

			{filteredPlayers.length === 0 && trimmed === "" ? (
				<p className="px-2 py-1 text-muted-foreground text-sm">
					No available players
				</p>
			) : (
				<ul className="flex max-h-56 flex-col overflow-y-auto">
					{filteredPlayers.map((p) => (
						<li key={p.id}>
							<button
								className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40"
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
