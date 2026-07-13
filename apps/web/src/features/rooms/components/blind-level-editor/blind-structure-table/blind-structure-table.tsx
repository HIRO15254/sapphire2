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
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
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
import { SortableGameSetRows } from "../sortable-game-set-rows";
import { SortableGamesRow } from "../sortable-games-row";
import { SortableLevelRow } from "../sortable-level-row";
import { useBlindStructureTable } from "./use-blind-structure-table";

interface BlindStructureTableProps {
	blindLabels: BlindSlotLabels;
	/** Variant label → the games it stands for (threaded to the sheet). */
	compositionFor?: (variantLabel: string) => string[];
	/**
	 * Seed used when a flat level converts to per-game sets (mix-master
	 * composition, amounts blank).
	 */
	defaultGames?: LevelGameGroup[] | null;
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: BlindLevelPatch) => void;
	/**
	 * Mix-master tournament: levels with game sets render one inline row per
	 * set (WSOP structure-sheet style); flat levels stay single-row and can
	 * toggle between the two shapes.
	 */
	hybridGames?: boolean;
	isAdding?: boolean;
	/** Per-level-variant tournament: rows edit per-level game groups via the sheet. */
	isMix?: boolean;
	levels: BlindLevelRow[];
	/** variant label → owning group; required when isMix (threaded to the sheet). */
	resolveGroup?: ResolveGroup;
	sensors: SensorDescriptor<SensorOptions>[];
}

const HEAD_CLASS =
	"h-auto pb-1 text-center font-medium text-muted-foreground text-xs";

export function BlindStructureTable({
	levels,
	blindLabels,
	compositionFor,
	defaultGames,
	sensors,
	hybridGames = false,
	isAdding = false,
	isMix = false,
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

	// Flat level → per-game sets, seeded from the mix's composition. Only
	// offered while the master data has resolved to a non-empty composition.
	const onUseGameSets = defaultGames?.length
		? (id: string) => handleUpdate(id, { games: defaultGames })
		: undefined;

	const hybridBody = (
		<>
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
									<TableBody key={row.id}>
										<SortableBreakRow
											gameColumn
											onDelete={handleDelete}
											onUpdate={handleUpdate}
											row={row}
										/>
									</TableBody>
								);
							}
							if ((row.games?.length ?? 0) > 0) {
								return (
									<SortableGameSetRows
										key={row.id}
										onDelete={handleDelete}
										onUpdate={handleUpdate}
										onUseSingleSet={(id) => handleUpdate(id, { games: null })}
										row={row}
									/>
								);
							}
							return (
								<TableBody key={row.id}>
									<SortableLevelRow
										gameColumn
										onDelete={handleDelete}
										onUpdate={handleUpdate}
										onUseGameSets={onUseGameSets}
										row={row}
									/>
								</TableBody>
							);
						})}
					</SortableContext>
				</DndContext>
			)}
			<TableBody>
				<EmptyRow gameColumn onCreateLevel={handleCreateLevel} />
			</TableBody>
		</>
	);

	const flatBody = (
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
	);

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
						<TableHead className={`${HEAD_CLASS} w-10`}>#</TableHead>
						{hybridGames && (
							<TableHead className={`${HEAD_CLASS} w-14 text-left`}>
								Game
							</TableHead>
						)}
						{isMix ? (
							<TableHead className={HEAD_CLASS} colSpan={3}>
								Games
							</TableHead>
						) : (
							<>
								<TableHead className={HEAD_CLASS}>
									{blindLabels.blind1}
								</TableHead>
								<TableHead className={HEAD_CLASS}>
									{blindLabels.blind2}
								</TableHead>
								<TableHead className={HEAD_CLASS}>Ante</TableHead>
							</>
						)}
						<TableHead className={`${HEAD_CLASS} w-12`}>Min</TableHead>
						<TableHead className="h-auto w-8 pb-1" />
						{hybridGames && <TableHead className="h-auto w-8 pb-1" />}
					</TableRow>
				</TableHeader>
				{hybridGames ? hybridBody : flatBody}
			</Table>
			{isMix && resolveGroup ? (
				<LevelPatternsSheet
					compositionFor={compositionFor ?? ((label) => [label])}
					games={openLevel?.games ?? null}
					level={openLevel?.level ?? 1}
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
