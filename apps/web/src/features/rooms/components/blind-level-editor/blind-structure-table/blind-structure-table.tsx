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
import type { BlindLabels } from "@sapphire2/db/constants/game-variants";
import { IconCoffee, IconPlus } from "@tabler/icons-react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { EmptyRow } from "../empty-row";
import { SortableBreakRow } from "../sortable-break-row";
import { SortableLevelRow } from "../sortable-level-row";

interface BlindStructureTableProps {
	blindLabels: BlindLabels;
	handleAddBreak: () => void;
	handleAddLevel: () => void;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleDragEnd: (event: DragEndEvent) => void;
	handleUpdate: (id: string, updates: Record<string, number | null>) => void;
	isAdding?: boolean;
	levels: BlindLevelRow[];
	sensors: SensorDescriptor<SensorOptions>[];
}

export function BlindStructureTable({
	levels,
	blindLabels,
	sensors,
	isAdding = false,
	handleDragEnd,
	handleAddBreak,
	handleAddLevel,
	handleDelete,
	handleUpdate,
	handleCreateLevel,
}: BlindStructureTableProps) {
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
						<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
							{blindLabels.blind1}
						</TableHead>
						<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
							{blindLabels.blind2}
						</TableHead>
						<TableHead className="h-auto pb-1 text-center font-medium text-muted-foreground text-xs">
							Ante
						</TableHead>
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
								{levels.map((row) =>
									row.isBreak ? (
										<SortableBreakRow
											key={row.id}
											onDelete={handleDelete}
											onUpdate={handleUpdate}
											row={row}
										/>
									) : (
										<SortableLevelRow
											key={row.id}
											onDelete={handleDelete}
											onUpdate={handleUpdate}
											row={row}
										/>
									)
								)}
							</SortableContext>
						</DndContext>
					)}
					<EmptyRow onCreateLevel={handleCreateLevel} />
				</TableBody>
			</Table>
		</div>
	);
}
