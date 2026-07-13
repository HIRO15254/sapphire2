import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconChevronRight, IconTrash } from "@tabler/icons-react";
import { groupDisplayLabel } from "@/features/live-sessions/utils/game-scene-formatters";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useSortableLevelRow } from "@/features/rooms/hooks/use-sortable-level-row";
import type { BlindLevelPatch } from "@/features/rooms/utils/blind-level-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { BLIND_DATA_COLUMNS } from "../blind-table-columns";
import { DragHandle } from "../drag-handle";

interface SortableGamesRowProps {
	onDelete: (id: string) => void;
	onOpenGames: (id: string) => void;
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	row: BlindLevelRow;
}

/**
 * Mix-mode level row: the flat blind cells are replaced by a "Games (n)"
 * summary button that opens the per-level group editor sheet; minutes and
 * delete stay inline.
 */
export function SortableGamesRow({
	row,
	onDelete,
	onOpenGames,
	onUpdate,
}: SortableGamesRowProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const { handleMinutesBlur } = useSortableLevelRow({ row, onUpdate });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const groups = row.games ?? [];
	const summary =
		groups.length > 0
			? groups.map((group) => groupDisplayLabel(group)).join(" · ")
			: "No games";

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
			<TableCell className="p-0 px-0.5" colSpan={BLIND_DATA_COLUMNS}>
				<Button
					className="w-full justify-between font-normal"
					onClick={() => onOpenGames(row.id)}
					size="sm"
					type="button"
					variant="ghost"
				>
					<span className="truncate text-xs">{summary}</span>
					<IconChevronRight className="shrink-0" size={14} />
				</Button>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput
					aria-label={`Level ${row.level} minutes`}
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
