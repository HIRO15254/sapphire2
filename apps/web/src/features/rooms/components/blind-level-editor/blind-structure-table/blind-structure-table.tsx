import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type SensorDescriptor,
	type SensorOptions,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { IconCoffee, IconPlus } from "@tabler/icons-react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type {
	BlindLevelPatch,
	NewLevelValues,
} from "@/features/rooms/utils/blind-level-helpers";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import type { ResolveGroup } from "@/shared/lib/mix-games";
import { EmptyRow } from "../empty-row";
import { LevelPatternsSheet } from "../level-patterns-sheet";
import { SortableBreakRow } from "../sortable-break-row";
import { SortableGamesRow } from "../sortable-games-row";
import { SortableLevelRow } from "../sortable-level-row";
import { useBlindStructureTable } from "./use-blind-structure-table";

interface BlindStructureTableProps {
	blindLabels: BlindSlotLabels;
	/** Variant label → the games it stands for (threaded to the sheet). */
	compositionFor?: (variantLabel: string) => string[];
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: BlindLevelPatch) => void;
	isAdding?: boolean;
	/** Mix tournament: level rows edit per-level game groups instead of flat blinds. */
	isMix?: boolean;
	/** "locked" = tournament-wide mix; "assign" = per-level variants. */
	levelSheetMode?: "assign" | "locked";
	levels: BlindLevelRow[];
	/** Composition every level is locked to (levelSheetMode "locked"). */
	lockedLabels?: string[];
	/** variant label → owning group; required when isMix (threaded to the sheet). */
	resolveGroup?: ResolveGroup;
	sensors: SensorDescriptor<SensorOptions>[];
}

export function BlindStructureTable({
	levels,
	blindLabels,
	compositionFor,
	sensors,
	isAdding = false,
	isMix = false,
	levelSheetMode = "assign",
	lockedLabels,
	resolveGroup,
	handleDragEnd,
	handleAddBreak,
	handleAddLevel,
	handleDelete,
	handleUpdate,
	handleCreateLevel,
}: BlindStructureTableProps) {
	const { openLevel, openGamesFor, closeGames } =
		useBlindStructureTable(levels);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-sm">
				Drag levels to reorder the structure. Use breaks for scheduled pauses
				between blind levels.
			</p>
			<div className="flex justify-end gap-2">
				<Button
					disabled={isAdding}
					onClick={handleAddBreak}
					size="sm"
					variant="outline"
				>
					<IconCoffee size={14} />
					Break
				</Button>
				<Button disabled={isAdding} onClick={handleAddLevel} size="sm">
					<IconPlus size={14} />
					Level
				</Button>
			</div>

			<Table className="table-fixed">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className="h-auto w-10 pb-1 text-center font-medium text-muted-foreground text-xs">
							#
						</TableHead>
						{isMix ? (
							<TableHead
								className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs"
								colSpan={3}
							>
								Games
							</TableHead>
						) : (
							<>
								<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
									{blindLabels.blind1}
								</TableHead>
								<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
									{blindLabels.blind2}
								</TableHead>
								<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
									Ante
								</TableHead>
							</>
						)}
						<TableHead className="h-auto w-12 pb-1 text-center font-medium text-muted-foreground text-xs">
							Min
						</TableHead>
						<TableHead className="h-auto w-8 pb-1" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{levels.length > 0 && (
						<DndContext
							collisionDetection={closestCenter}
							onDragEnd={handleDragEnd}
							sensors={sensors}
						>
							<SortableContext
								items={levels.map((l) => l.id)}
								strategy={verticalListSortingStrategy}
							>
								{levels.map((row) => {
									if (row.isBreak) {
										return (
											<SortableBreakRow
												key={row.id}
												onDelete={handleDelete}
												onUpdate={handleUpdate}
												row={row}
											/>
										);
									}
									if (isMix) {
										return (
											<SortableGamesRow
												key={row.id}
												onDelete={handleDelete}
												onOpenGames={openGamesFor}
												onUpdate={handleUpdate}
												row={row}
											/>
										);
									}
									return (
										<SortableLevelRow
											key={row.id}
											onDelete={handleDelete}
											onUpdate={handleUpdate}
											row={row}
										/>
									);
								})}
							</SortableContext>
						</DndContext>
					)}
					<EmptyRow onCreateLevel={handleCreateLevel} />
				</TableBody>
			</Table>
			{isMix && resolveGroup ? (
				<LevelPatternsSheet
					compositionFor={compositionFor ?? ((label) => [label])}
					games={openLevel?.games ?? null}
					level={openLevel?.level ?? 1}
					lockedLabels={lockedLabels}
					mode={levelSheetMode}
					onOpenChange={(open) => {
						if (!open) {
							closeGames();
						}
					}}
					onSave={(games) => {
						if (openLevel) {
							handleUpdate(openLevel.id, { games });
						}
					}}
					open={openLevel !== null}
					resolveGroup={resolveGroup}
				/>
			) : null}
		</div>
	);
}
