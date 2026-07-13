import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconCoffee, IconTrash } from "@tabler/icons-react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	type BlindLevelPatch,
	parseBlindLevelInput,
} from "@/features/rooms/utils/blind-level-helpers";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { BLIND_DATA_COLUMNS } from "../blind-table-columns";
import { DragHandle } from "../drag-handle";

interface SortableBreakRowProps {
	/** Widen the break label to span the hybrid table's Game column. */
	gameColumn?: boolean;
	/** Hybrid tables add this slot when any game group has a third blind. */
	hasBlind3Column?: boolean;
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	row: BlindLevelRow;
}

export function SortableBreakRow({
	row,
	gameColumn = false,
	hasBlind3Column = false,
	onDelete,
	onUpdate,
}: SortableBreakRowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<TableRow
			className="bg-muted/30 hover:bg-muted/30"
			ref={setNodeRef}
			style={style}
		>
			<TableCell className="w-10 p-0 px-0.5 text-center">
				<div className="flex items-center justify-center gap-0.5">
					<DragHandle attributes={attributes} listeners={listeners} />
					<span className="text-muted-foreground text-xs">{row.level}</span>
				</div>
			</TableCell>
			<TableCell
				className="p-0 px-1.5 py-1"
				colSpan={
					BLIND_DATA_COLUMNS + Number(gameColumn) + Number(hasBlind3Column)
				}
			>
				<div className="flex items-center gap-1 text-muted-foreground text-sm">
					<IconCoffee size={14} />
					<span>Break</span>
				</div>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput
					aria-label={`Break level ${row.level} minutes`}
					defaultValue={row.minutes ?? ""}
					key={`${row.id}-minutes`}
					onBlur={(e) => {
						const minutes = parseBlindLevelInput(e.target);
						if (minutes !== undefined) {
							onUpdate(row.id, { minutes });
						}
					}}
				/>
			</TableCell>
			<TableCell className="w-8 p-0 px-0.5 text-center">
				<Button
					aria-label="Delete break"
					className="text-muted-foreground hover:text-destructive"
					onClick={() => onDelete(row.id)}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<IconTrash size={14} />
				</Button>
			</TableCell>
		</TableRow>
	);
}
