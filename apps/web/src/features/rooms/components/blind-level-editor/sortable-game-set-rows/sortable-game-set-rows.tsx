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
import { PENDING_GROUP_ID, type ResolveGroup } from "@/shared/lib/mix-games";
import { BlindLevelInput } from "../blind-level-input";
import { DragHandle } from "../drag-handle";

interface SortableGameSetRowsProps {
	hasBlind3Column: boolean;
	onDelete: (id: string) => void;
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	onUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	resolveGroup?: ResolveGroup;
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
	hasBlind3Column,
	resolveGroup,
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
			{games.map((set, index) => {
				const group = resolveGroup?.(set.variants[0] ?? "");
				// Label the row with the owning group's name (same as the
				// per-group header), not the set's composition/custom name — the
				// header labels amounts by group, so the row label must match to
				// avoid a group-name/composition mismatch. The stored set.name is
				// still submitted and drives the live timer display. When the
				// group cannot be resolved (orphaned mix / masters not loaded),
				// fall back to the composition so no misleading fallback name
				// shows.
				const gameLabel =
					group && group.id !== PENDING_GROUP_ID
						? group.label
						: groupDisplayLabel(set);
				const blind1Label = group?.blind1Label ?? "Blind 1";
				const blind2Label = group?.blind2Label ?? "Blind 2";
				const blind3Label = group?.blind3Label;
				return (
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
								{gameLabel}
							</span>
						</TableCell>
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`Level ${row.level} ${gameLabel} ${blind1Label}`}
								defaultValue={set.blind1 ?? ""}
								key={setFieldKey(index, "blind1")}
								onBlur={handleSetFieldBlur(index, "blind1")}
								onFocus={handleSetFieldFocus(index, "blind1")}
							/>
						</TableCell>
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`Level ${row.level} ${gameLabel} ${blind2Label}`}
								defaultValue={set.blind2 ?? ""}
								key={setFieldKey(index, "blind2")}
								onBlur={handleSetFieldBlur(index, "blind2")}
								onFocus={handleSetFieldFocus(index, "blind2")}
							/>
						</TableCell>
						{hasBlind3Column && (
							<TableCell className="p-0 px-0.5">
								{blind3Label !== null && blind3Label !== undefined ? (
									<BlindLevelInput
										aria-label={`Level ${row.level} ${gameLabel} ${blind3Label}`}
										defaultValue={set.blind3 ?? ""}
										key={setFieldKey(index, "blind3")}
										onBlur={handleSetFieldBlur(index, "blind3")}
										onFocus={handleSetFieldFocus(index, "blind3")}
									/>
								) : null}
							</TableCell>
						)}
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`Level ${row.level} ${gameLabel} Ante`}
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
										aria-label={`Level ${row.level} minutes`}
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
				);
			})}
		</TableBody>
	);
}
