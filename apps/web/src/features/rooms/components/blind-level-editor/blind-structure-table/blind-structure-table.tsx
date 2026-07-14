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
import type { ReactNode } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type {
	BlindLevelPatch,
	GameSetCellPatch,
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
import { BLIND_DATA_COLUMNS } from "../blind-table-columns";
import { EmptyGameSetRows } from "../empty-game-set-rows";
import { EmptyGamesRow } from "../empty-games-row";
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
	 * The mix-master composition: seeds new levels' game sets (amounts blank)
	 * and drives the per-group header rows. Null for plain variants and for
	 * orphaned mixes whose master was deleted.
	 */
	defaultGames?: LevelGameGroup[] | null;
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: BlindLevelPatch) => void;
	handleUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	/**
	 * Mix-master tournament (or orphaned levels that still carry game sets):
	 * levels with game sets render one inline row per set (WSOP
	 * structure-sheet style); levels without games stay single flat rows.
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

function flatLabels(
	hybridGames: boolean,
	blindLabels: BlindSlotLabels
): BlindSlotLabels {
	if (hybridGames) {
		return { blind1: "Blind 1", blind2: "Blind 2", blind3: null };
	}
	return blindLabels;
}

function plainBlind3Label(
	isMix: boolean,
	blindLabels: BlindSlotLabels
): string | null {
	if (isMix) {
		return null;
	}
	return blindLabels.blind3;
}

function blind3HeaderLabel(
	hybridGames: boolean,
	blindLabels: BlindSlotLabels
): string | null {
	if (hybridGames) {
		return "Blind 3";
	}
	return blindLabels.blind3;
}

interface SortableTableProps {
	children: ReactNode;
	handleDragEnd: (event: DragEndEvent) => void;
	levels: BlindLevelRow[];
	sensors: SensorDescriptor<SensorOptions>[];
}

// dnd-kit injects live-region and focus-restoration <div> elements next to its
// children. Keep both providers outside <table> so those accessibility nodes
// never become invalid table descendants. The sortable unit remains a level.
function SortableTable({
	children,
	levels,
	sensors,
	handleDragEnd,
}: SortableTableProps) {
	if (levels.length === 0) {
		return children;
	}
	return (
		<DndContext
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
			sensors={sensors}
		>
			<SortableContext
				items={levels.map((l) => l.id)}
				strategy={verticalListSortingStrategy}
			>
				{children}
			</SortableContext>
		</DndContext>
	);
}

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
	handleUpdateGameSet,
	handleCreateLevel,
}: BlindStructureTableProps) {
	const { hasBlind3Column, headerGroups, openLevel, openGamesFor, closeGames } =
		useBlindStructureTable(levels, {
			defaultGames,
			hybridGames,
			plainBlind3Label: plainBlind3Label(isMix, blindLabels),
			resolveGroup,
		});
	const flatBlindLabels = flatLabels(hybridGames, blindLabels);

	// Mix-master (or orphaned game-set) body: each level is its own <tbody>
	// block — game-set levels render one inline row per set, breaks and
	// legacy flat levels stay single-row. The add-row seeds the composition's
	// sets; with no composition (orphaned mix) it falls back to the flat
	// empty row (documented empty-composition behavior).
	const hybridBody = (
		<>
			{levels.map((row) => {
				if (row.isBreak) {
					return (
						<TableBody key={row.id}>
							<SortableBreakRow
								gameColumn
								hasBlind3Column={hasBlind3Column}
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
							hasBlind3Column={hasBlind3Column}
							key={row.id}
							onDelete={handleDelete}
							onUpdate={handleUpdate}
							onUpdateGameSet={handleUpdateGameSet}
							resolveGroup={resolveGroup}
							row={row}
						/>
					);
				}
				return (
					<TableBody key={row.id}>
						<SortableLevelRow
							blindLabels={flatBlindLabels}
							gameColumn
							hasBlind3Column={hasBlind3Column}
							onDelete={handleDelete}
							onUpdate={handleUpdate}
							row={row}
						/>
					</TableBody>
				);
			})}
			{defaultGames?.length ? (
				<EmptyGameSetRows
					hasBlind3Column={hasBlind3Column}
					onCreateLevel={handleCreateLevel}
					resolveGroup={resolveGroup}
					seeds={defaultGames}
				/>
			) : (
				<TableBody>
					<EmptyRow
						blindLabels={flatBlindLabels}
						gameColumn
						hasBlind3Column={hasBlind3Column}
						onCreateLevel={handleCreateLevel}
					/>
				</TableBody>
			)}
		</>
	);

	// Flat body: plain variants edit blind cells inline; per-level ('mix')
	// mode replaces them with a "Games" summary row per level, and its
	// add-row has no blind inputs (amounts typed there would be invisible on
	// the summary row) — just Min + an explicit add button.
	const flatBody = (
		<TableBody>
			{levels.map((row) => {
				if (row.isBreak) {
					return (
						<SortableBreakRow
							hasBlind3Column={hasBlind3Column}
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
						blindLabels={flatBlindLabels}
						hasBlind3Column={hasBlind3Column}
						key={row.id}
						onDelete={handleDelete}
						onUpdate={handleUpdate}
						row={row}
					/>
				);
			})}
			{isMix ? (
				<EmptyGamesRow onCreateLevel={handleCreateLevel} />
			) : (
				<EmptyRow
					blindLabels={flatBlindLabels}
					hasBlind3Column={hasBlind3Column}
					onCreateLevel={handleCreateLevel}
				/>
			)}
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

			<SortableTable
				handleDragEnd={handleDragEnd}
				levels={levels}
				sensors={sensors}
			>
				<Table className="table-fixed">
					<TableHeader>
						{headerGroups ? (
							// One header row per game of the mix composition, each labeled
							// with its group's blind slots (WSOP structure-sheet style).
							headerGroups.map((group, index) => (
								<TableRow className="hover:bg-transparent" key={group.key}>
									{index === 0 && (
										<TableHead
											className={`${HEAD_CLASS} w-10`}
											rowSpan={headerGroups.length}
										>
											#
										</TableHead>
									)}
									<TableHead className={`${HEAD_CLASS} w-14 text-left`}>
										{group.label}
									</TableHead>
									<TableHead className={HEAD_CLASS}>
										{group.blind1Label}
									</TableHead>
									<TableHead className={HEAD_CLASS}>
										{group.blind2Label}
									</TableHead>
									{hasBlind3Column && (
										<TableHead className={HEAD_CLASS}>
											{group.blind3Label}
										</TableHead>
									)}
									<TableHead className={HEAD_CLASS}>Ante</TableHead>
									{index === 0 && (
										<>
											<TableHead
												className={`${HEAD_CLASS} w-12`}
												rowSpan={headerGroups.length}
											>
												Min
											</TableHead>
											<TableHead
												className="h-auto w-8 pb-1"
												rowSpan={headerGroups.length}
											/>
										</>
									)}
								</TableRow>
							))
						) : (
							<TableRow className="hover:bg-transparent">
								<TableHead className={`${HEAD_CLASS} w-10`}>#</TableHead>
								{hybridGames && (
									<TableHead className={`${HEAD_CLASS} w-14 text-left`}>
										Game
									</TableHead>
								)}
								{isMix ? (
									<TableHead
										className={HEAD_CLASS}
										colSpan={BLIND_DATA_COLUMNS}
									>
										Games
									</TableHead>
								) : (
									<>
										<TableHead className={HEAD_CLASS}>
											{hybridGames ? "Blind 1" : blindLabels.blind1}
										</TableHead>
										<TableHead className={HEAD_CLASS}>
											{hybridGames ? "Blind 2" : blindLabels.blind2}
										</TableHead>
										{hasBlind3Column && (
											<TableHead className={HEAD_CLASS}>
												{blind3HeaderLabel(hybridGames, blindLabels)}
											</TableHead>
										)}
										<TableHead className={HEAD_CLASS}>Ante</TableHead>
									</>
								)}
								<TableHead className={`${HEAD_CLASS} w-12`}>Min</TableHead>
								<TableHead className="h-auto w-8 pb-1" />
							</TableRow>
						)}
					</TableHeader>
					{hybridGames ? hybridBody : flatBody}
				</Table>
			</SortableTable>
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
