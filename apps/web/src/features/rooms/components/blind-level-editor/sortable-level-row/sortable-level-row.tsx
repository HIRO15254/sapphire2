import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconTrash } from "@tabler/icons-react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useSortableLevelRow } from "@/features/rooms/hooks/use-sortable-level-row";
import type { BlindLevelPatch } from "@/features/rooms/utils/blind-level-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { DragHandle } from "../drag-handle";

interface SortableLevelRowProps {
	/** Leading empty Game cell so the row aligns with a hybrid table. */
	gameColumn?: boolean;
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	row: BlindLevelRow;
}

export function SortableLevelRow({
	row,
	gameColumn = false,
	onDelete,
	onUpdate,
}: SortableLevelRowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const {
		handleBlind1Blur,
		handleBlind2Blur,
		handleAnteBlur,
		handleMinutesBlur,
	} = useSortableLevelRow({ row, onUpdate });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<TableRow
			className={cn("hover:bg-transparent", isDragging && "opacity-50")}
			ref={setNodeRef}
			style={style}
		>
			<TableCell className="w-10 p-0 px-0.5 text-center">
				<div className="flex items-center justify-center gap-0.5">
					<DragHandle attributes={attributes} listeners={listeners} />
					<span className="text-muted-foreground text-xs">{row.level}</span>
				</div>
			</TableCell>
			{gameColumn && <TableCell className="p-0 px-1" />}
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					defaultValue={row.blind1 ?? ""}
					key={`${row.id}-blind1`}
					onBlur={handleBlind1Blur}
				/>
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					defaultValue={row.blind2 ?? ""}
					key={`${row.id}-blind2-${row.blind2}`}
					onBlur={handleBlind2Blur}
				/>
			</TableCell>
			<TableCell className="p-0 px-0.5">
				<BlindLevelInput
					defaultValue={row.ante ?? ""}
					key={`${row.id}-ante-${row.ante}`}
					onBlur={handleAnteBlur}
				/>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput
					defaultValue={row.minutes ?? ""}
					key={`${row.id}-minutes`}
					onBlur={handleMinutesBlur}
				/>
			</TableCell>
			<TableCell className="w-8 p-0 px-0.5 text-center">
				<Button
					aria-label="Delete level"
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
