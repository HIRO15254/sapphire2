import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconCoffee, IconTrash } from "@tabler/icons-react";
import type { BlindLabels } from "@/features/game-variants/utils/blind-labels";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { parseIntOrNull } from "@/features/rooms/utils/blind-level-helpers";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { DragHandle } from "../drag-handle";

interface SortableBreakRowProps {
	blindLabels: BlindLabels;
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: Record<string, number | null>) => void;
	row: BlindLevelRow;
}

// The break row's label cell spans the blind1 + blind2 + ante columns (not
// minutes). It must shrink when a variant hides a blind column so the row
// stays aligned with the header (SA2 user-defined variants).
function labelColSpan(blindLabels: BlindLabels): number {
	return (
		(blindLabels.blind1 == null ? 0 : 1) +
		(blindLabels.blind2 == null ? 0 : 1) +
		1
	);
}

export function SortableBreakRow({
	row,
	blindLabels,
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
				colSpan={labelColSpan(blindLabels)}
			>
				<div className="flex items-center gap-1 text-muted-foreground text-sm">
					<IconCoffee size={14} />
					<span>Break</span>
				</div>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput
					defaultValue={row.minutes ?? ""}
					key={`${row.id}-minutes`}
					onBlur={(e) =>
						onUpdate(row.id, { minutes: parseIntOrNull(e.target.value) })
					}
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
