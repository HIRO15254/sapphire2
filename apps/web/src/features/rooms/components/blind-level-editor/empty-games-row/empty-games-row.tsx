import { IconPlus } from "@tabler/icons-react";
import { useEmptyGamesRow } from "@/features/rooms/hooks/use-empty-games-row";
import type { NewLevelValues } from "@/features/rooms/utils/blind-level-helpers";
import { Button } from "@/shared/components/ui/button";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { BlindLevelInput } from "../blind-level-input";
import { BLIND_DATA_COLUMNS } from "../blind-table-columns";

interface EmptyGamesRowProps {
	onCreateLevel: (values: NewLevelValues) => void;
}

/**
 * New-level row for per-level ('mix') mode: no flat blind inputs (their
 * amounts would be invisible on a "Games" summary row) — just a Min cell and
 * an add button. The created level's games are assigned via the sheet.
 */
export function EmptyGamesRow({ onCreateLevel }: EmptyGamesRowProps) {
	const { minutesRef, handleAddLevel } = useEmptyGamesRow({ onCreateLevel });

	return (
		<TableRow className="border-t border-dashed hover:bg-transparent">
			<TableCell className="w-10 p-0 px-0.5 text-center">
				<span className="text-muted-foreground text-xs">+</span>
			</TableCell>
			<TableCell className="p-0 px-0.5" colSpan={BLIND_DATA_COLUMNS}>
				<Button
					className="w-full justify-start font-normal text-muted-foreground"
					onClick={handleAddLevel}
					size="sm"
					type="button"
					variant="ghost"
				>
					<IconPlus size={14} />
					Add level
				</Button>
			</TableCell>
			<TableCell className="w-12 p-0 px-0.5">
				<BlindLevelInput ref={minutesRef} />
			</TableCell>
			<TableCell className="w-8 p-0" />
		</TableRow>
	);
}
