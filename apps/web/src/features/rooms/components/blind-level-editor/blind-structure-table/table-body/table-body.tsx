import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type {
	BlindLevelPatch,
	GameSetCellPatch,
	NewLevelValues,
} from "@/features/rooms/utils/blind-level-helpers";
import { TableBody } from "@/shared/components/ui/table";
import type { BlindSlotLabels } from "@/shared/hooks/use-variant-labels";
import type { ResolveGroup } from "@/shared/lib/mix-games";
import { EmptyGameSetRows } from "../../empty-game-set-rows";
import { EmptyGamesRow } from "../../empty-games-row";
import { EmptyRow } from "../../empty-row";
import { SortableBreakRow } from "../../sortable-break-row";
import { SortableGameSetRows } from "../../sortable-game-set-rows";
import { SortableGamesRow } from "../../sortable-games-row";
import { SortableLevelRow } from "../../sortable-level-row";

interface BlindStructureTableBodyProps {
	defaultGames?: LevelGameGroup[] | null;
	flatBlindLabels: BlindSlotLabels;
	handleCreateLevel: (values: NewLevelValues) => void;
	handleDelete: (id: string) => void;
	handleUpdate: (id: string, updates: BlindLevelPatch) => void;
	handleUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	hasBlind3Column: boolean;
	hybridGames: boolean;
	isMix: boolean;
	levels: BlindLevelRow[];
	onOpenGames: (id: string) => void;
	resolveGroup?: ResolveGroup;
}

export function BlindStructureTableBody({
	defaultGames,
	flatBlindLabels,
	handleCreateLevel,
	handleDelete,
	handleUpdate,
	handleUpdateGameSet,
	hasBlind3Column,
	hybridGames,
	isMix,
	levels,
	onOpenGames,
	resolveGroup,
}: BlindStructureTableBodyProps) {
	if (hybridGames) {
		return (
			<>
				{levels.map((row) => {
					if (row.isBreak) {
						return (
							<TableBody key={row.id}>
								<SortableBreakRow
									gameColumn
									hasBlind3Column={hasBlind3Column}
									onDelete={handleDelete}
									onUpdate={handleUpdate}
									row={row}
								/>
							</TableBody>
						);
					}
					if ((row.games?.length ?? 0) > 0) {
						return (
							<SortableGameSetRows
								hasBlind3Column={hasBlind3Column}
								key={row.id}
								onDelete={handleDelete}
								onUpdate={handleUpdate}
								onUpdateGameSet={handleUpdateGameSet}
								resolveGroup={resolveGroup}
								row={row}
							/>
						);
					}
					return (
						<TableBody key={row.id}>
							<SortableLevelRow
								blindLabels={flatBlindLabels}
								gameColumn
								hasBlind3Column={hasBlind3Column}
								onDelete={handleDelete}
								onUpdate={handleUpdate}
								row={row}
							/>
						</TableBody>
					);
				})}
				{defaultGames?.length ? (
					<EmptyGameSetRows
						hasBlind3Column={hasBlind3Column}
						onCreateLevel={handleCreateLevel}
						resolveGroup={resolveGroup}
						seeds={defaultGames}
					/>
				) : (
					<TableBody>
						<EmptyRow
							blindLabels={flatBlindLabels}
							gameColumn
							hasBlind3Column={hasBlind3Column}
							onCreateLevel={handleCreateLevel}
						/>
					</TableBody>
				)}
			</>
		);
	}

	return (
		<TableBody>
			{levels.map((row) => {
				if (row.isBreak) {
					return (
						<SortableBreakRow
							hasBlind3Column={hasBlind3Column}
							key={row.id}
							onDelete={handleDelete}
							onUpdate={handleUpdate}
							row={row}
						/>
					);
				}
				if (isMix) {
					return (
						<SortableGamesRow
							key={row.id}
							onDelete={handleDelete}
							onOpenGames={onOpenGames}
							onUpdate={handleUpdate}
							row={row}
						/>
					);
				}
				return (
					<SortableLevelRow
						blindLabels={flatBlindLabels}
						hasBlind3Column={hasBlind3Column}
						key={row.id}
						onDelete={handleDelete}
						onUpdate={handleUpdate}
						row={row}
					/>
				);
			})}
			{isMix ? (
				<EmptyGamesRow onCreateLevel={handleCreateLevel} />
			) : (
				<EmptyRow
					blindLabels={flatBlindLabels}
					hasBlind3Column={hasBlind3Column}
					onCreateLevel={handleCreateLevel}
				/>
			)}
		</TableBody>
	);
}
