import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconTrash } from "@tabler/icons-react";
import { groupDisplayLabel } from "@/features/live-sessions/utils/game-scene-formatters";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useGameSetRows } from "@/features/rooms/hooks/use-game-set-rows";
import type {
	BlindLevelPatch,
	GameSetCellPatch,
} from "@/features/rooms/utils/blind-level-helpers";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { TableBody, TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { DragHandle } from "../drag-handle";

interface SortableGameSetRowsProps {
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	onUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	row: BlindLevelRow;
}

/**
 * Mix-master level rendered WSOP-structure-sheet style: one inline table
 * row per game set, amounts edited directly in the cells. Level-scoped
 * cells (number/drag, minutes, delete) span the whole block via rowSpan;
 * the sortable/drag unit is the level, so the block is its own `<tbody>`.
 */
export function SortableGameSetRows({
	row,
	onDelete,
	onUpdate,
	onUpdateGameSet,
}: SortableGameSetRowsProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: row.id });

	const {
		games,
		handleSetFieldBlur,
		handleSetFieldFocus,
		handleMinutesBlur,
		setFieldKey,
	} = useGameSetRows({ row, onUpdate, onUpdateGameSet });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	const rowSpan = Math.max(games.length, 1);

	return (
		<TableBody ref={setNodeRef} style={style}>
			{games.map((set, index) => (
				<TableRow
					className={cn("hover:bg-transparent", isDragging && "opacity-50")}
					// biome-ignore lint/suspicious/noArrayIndexKey: sets have no id; order within a level is stable (composition order) and rows fully re-render from row.games.
					key={`${row.id}-set-${index}`}
				>
					{index === 0 && (
						<TableCell
							className="w-10 p-0 px-0.5 text-center align-middle"
							rowSpan={rowSpan}
						>
							<div className="flex items-center justify-center gap-0.5">
								<DragHandle attributes={attributes} listeners={listeners} />
								<span className="text-muted-foreground text-xs">
									{row.level}
								</span>
							</div>
						</TableCell>
					)}
					<TableCell className="p-0 px-1">
						<span className="block truncate text-muted-foreground text-xs">
							{groupDisplayLabel(set)}
						</span>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
							defaultValue={set.blind1 ?? ""}
							key={setFieldKey(index, "blind1")}
							onBlur={handleSetFieldBlur(index, "blind1")}
							onFocus={handleSetFieldFocus(index, "blind1")}
						/>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
							defaultValue={set.blind2 ?? ""}
							key={setFieldKey(index, "blind2")}
							onBlur={handleSetFieldBlur(index, "blind2")}
							onFocus={handleSetFieldFocus(index, "blind2")}
						/>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
							defaultValue={set.ante ?? ""}
							key={setFieldKey(index, "ante")}
							onBlur={handleSetFieldBlur(index, "ante")}
							onFocus={handleSetFieldFocus(index, "ante")}
						/>
					</TableCell>
					{index === 0 && (
						<>
							<TableCell
								className="w-12 p-0 px-0.5 align-middle"
								rowSpan={rowSpan}
							>
								<BlindLevelInput
									defaultValue={row.minutes ?? ""}
									key={`${row.id}-minutes`}
									onBlur={handleMinutesBlur}
								/>
							</TableCell>
							<TableCell
								className="w-8 p-0 px-0.5 text-center align-middle"
								rowSpan={rowSpan}
							>
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
						</>
					)}
				</TableRow>
			))}
		</TableBody>
	);
}
