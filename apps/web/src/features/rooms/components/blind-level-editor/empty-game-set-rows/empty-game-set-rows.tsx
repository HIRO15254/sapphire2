import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { groupDisplayLabel } from "@/features/live-sessions/utils/game-scene-formatters";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { cn } from "@/lib/utils";
import { TableBody, TableCell, TableRow } from "@/shared/components/ui/table";
import { PENDING_GROUP_ID, type ResolveGroup } from "@/shared/lib/mix-games";
import { BlindLevelInput } from "../blind-level-input";
import { useEmptyGameSetRowsView } from "./use-empty-game-set-rows-view";

interface EmptyGameSetRowsProps {
	hasBlind3Column: boolean;
	onCreateLevel: (values: NewLevelValues) => void;
	resolveGroup?: ResolveGroup;
	/** Mix composition shaping the new level's sets (one row per game). */
	seeds: LevelGameGroup[];
}

/**
 * Mix-master new-level block: like EmptyRow, but one inline row per game
 * of the composition — typing amounts creates a level with per-game blind
 * sets. Level-scoped cells (the "+" marker, minutes, delete-column
 * placeholder) span the block via rowSpan, mirroring SortableGameSetRows.
 */
export function EmptyGameSetRows({
	seeds,
	onCreateLevel,
	hasBlind3Column,
	resolveGroup,
}: EmptyGameSetRowsProps) {
	const { registerCell, minutesRef, handleCellBlur, handleMinutesBlur } =
		useEmptyGameSetRowsView({ seeds, onCreateLevel });

	const rowSpan = Math.max(seeds.length, 1);

	return (
		<TableBody>
			{seeds.map((seed, index) => {
				const group = resolveGroup?.(seed.variants[0] ?? "");
				// Match the per-group header and the stored game-set rows: label
				// by the owning group's name, not the composition (see
				// sortable-game-set-rows.tsx). Fall back to the composition when
				// the group is unresolved (pending/orphaned).
				const gameLabel =
					group && group.id !== PENDING_GROUP_ID
						? group.label
						: groupDisplayLabel(seed);
				const blind1Label = group?.blind1Label ?? "Blind 1";
				const blind2Label = group?.blind2Label ?? "Blind 2";
				const blind3Label = group?.blind3Label;
				return (
					<TableRow
						className={cn(
							"hover:bg-transparent",
							index === 0 && "border-t border-dashed"
						)}
						key={seed.variants.join("+")}
					>
						{index === 0 && (
							<TableCell
								className="w-10 p-0 px-0.5 text-center align-middle"
								rowSpan={rowSpan}
							>
								<span className="text-muted-foreground text-xs">+</span>
							</TableCell>
						)}
						<TableCell className="p-0 px-1">
							<span className="block truncate text-muted-foreground text-xs">
								{gameLabel}
							</span>
						</TableCell>
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`New level ${gameLabel} ${blind1Label}`}
								onBlur={handleCellBlur(index, "blind1")}
								ref={registerCell(index, "blind1")}
							/>
						</TableCell>
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`New level ${gameLabel} ${blind2Label}`}
								onBlur={handleCellBlur(index, "blind2")}
								ref={registerCell(index, "blind2")}
							/>
						</TableCell>
						{hasBlind3Column && (
							<TableCell className="p-0 px-0.5">
								{blind3Label !== null && blind3Label !== undefined ? (
									<BlindLevelInput
										aria-label={`New level ${gameLabel} ${blind3Label}`}
										onBlur={handleCellBlur(index, "blind3")}
										ref={registerCell(index, "blind3")}
									/>
								) : null}
							</TableCell>
						)}
						<TableCell className="p-0 px-0.5">
							<BlindLevelInput
								aria-label={`New level ${gameLabel} Ante`}
								onBlur={handleCellBlur(index, "ante")}
								ref={registerCell(index, "ante")}
							/>
						</TableCell>
						{index === 0 && (
							<>
								<TableCell
									className="w-12 p-0 px-0.5 align-middle"
									rowSpan={rowSpan}
								>
									<BlindLevelInput
										aria-label="New level minutes"
										onBlur={handleMinutesBlur}
										ref={minutesRef}
									/>
								</TableCell>
								<TableCell className="w-8 p-0" rowSpan={rowSpan} />
							</>
						)}
					</TableRow>
				);
			})}
		</TableBody>
	);
}
