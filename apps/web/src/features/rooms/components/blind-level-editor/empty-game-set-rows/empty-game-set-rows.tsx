import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { groupDisplayLabel } from "@/features/live-sessions/utils/game-scene-formatters";
import { useEmptyGameSetRows } from "@/features/rooms/hooks/use-empty-game-set-rows";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { cn } from "@/lib/utils";
import { TableBody, TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";

interface EmptyGameSetRowsProps {
	onCreateLevel: (values: NewLevelValues) => void;
	/** Mix composition shaping the new level's sets (one row per game). */
	seeds: LevelGameGroup[];
}

/**
 * Mix-master new-level block: like EmptyRow, but one inline row per game
 * of the composition — typing amounts creates a level with per-game blind
 * sets. Level-scoped cells (the "+" marker, minutes, action-column
 * placeholders) span the block via rowSpan, mirroring SortableGameSetRows.
 */
export function EmptyGameSetRows({
	seeds,
	onCreateLevel,
}: EmptyGameSetRowsProps) {
	const { registerCell, minutesRef, handleCellBlur, handleMinutesBlur } =
		useEmptyGameSetRows({ seeds, onCreateLevel });

	const rowSpan = Math.max(seeds.length, 1);

	return (
		<TableBody>
			{seeds.map((seed, index) => (
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
							{groupDisplayLabel(seed)}
						</span>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
							onBlur={handleCellBlur(index, "blind1")}
							ref={registerCell(index, "blind1")}
						/>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
							onBlur={handleCellBlur(index, "blind2")}
							ref={registerCell(index, "blind2")}
						/>
					</TableCell>
					<TableCell className="p-0 px-0.5">
						<BlindLevelInput
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
								<BlindLevelInput onBlur={handleMinutesBlur} ref={minutesRef} />
							</TableCell>
							<TableCell className="w-8 p-0" rowSpan={rowSpan} />
							<TableCell className="w-8 p-0" rowSpan={rowSpan} />
						</>
					)}
				</TableRow>
			))}
		</TableBody>
	);
}
