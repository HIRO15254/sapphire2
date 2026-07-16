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
import type { ReactNode } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { Button } from "@/shared/components/ui/button";
import { Table } from "@/shared/components/ui/table";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import { LevelPatternsSheet } from "../level-patterns-sheet";
import type { BlindStructureTableProps } from "./blind-structure-table-types";
import { BlindStructureTableBody } from "./table-body";
import { BlindStructureTableHeader } from "./table-header";
import { useBlindStructureTable } from "./use-blind-structure-table";

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

interface SortableTableProps {
	children: ReactNode;
	handleDragEnd: (event: DragEndEvent) => void;
	levels: BlindLevelRow[];
	sensors: SensorDescriptor<SensorOptions>[];
}

// dnd-kit injects live-region and focus-restoration div elements next to its
// children. Keep both providers outside table so those accessibility nodes
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
				items={levels.map((level) => level.id)}
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
					type="button"
					variant="outline"
				>
					<IconCoffee size={14} />
					Break
				</Button>
				<Button
					disabled={isAdding}
					onClick={handleAddLevel}
					size="sm"
					type="button"
				>
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
					<BlindStructureTableHeader
						blindLabels={blindLabels}
						hasBlind3Column={hasBlind3Column}
						headerGroups={headerGroups}
						hybridGames={hybridGames}
						isMix={isMix}
					/>
					<BlindStructureTableBody
						defaultGames={defaultGames}
						flatBlindLabels={flatBlindLabels}
						handleCreateLevel={handleCreateLevel}
						handleDelete={handleDelete}
						handleUpdate={handleUpdate}
						handleUpdateGameSet={handleUpdateGameSet}
						hasBlind3Column={hasBlind3Column}
						hybridGames={hybridGames}
						isMix={isMix}
						levels={levels}
						onOpenGames={openGamesFor}
						resolveGroup={resolveGroup}
					/>
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
