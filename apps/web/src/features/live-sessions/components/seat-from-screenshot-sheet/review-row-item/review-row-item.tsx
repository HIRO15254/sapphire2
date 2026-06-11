import { IconAlertTriangle } from "@tabler/icons-react";
import type {
	PlayerOption,
	ReviewRow,
	RowAction,
} from "@/features/live-sessions/utils/seat-screenshot";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/components/ui/badge";
import { SeatCombobox } from "../seat-combobox";

const ACTION_BADGE_VARIANT: Record<RowAction, "default" | "secondary"> = {
	hero: "default",
	existing: "secondary",
	new: "default",
	skip: "secondary",
};

const ACTION_BADGE_CLASS: Record<RowAction, string> = {
	hero: "border-amber-400 bg-amber-500/80 text-white",
	existing: "",
	new: "bg-violet-500 text-white hover:bg-violet-500/90",
	skip: "text-muted-foreground",
};

const ACTION_BADGE_LABEL: Record<RowAction, string> = {
	hero: "Hero",
	existing: "Existing",
	new: "New",
	skip: "Skip",
};

export function ReviewRowItem({
	allPlayers,
	heroAlreadySeatedElsewhere,
	heroAvailable,
	onActionChange,
	onNameChange,
	onSelectExisting,
	row,
}: {
	allPlayers: PlayerOption[];
	heroAlreadySeatedElsewhere: boolean;
	heroAvailable: boolean;
	onActionChange: (next: RowAction) => void;
	onNameChange: (next: string) => void;
	onSelectExisting: (player: PlayerOption) => void;
	row: ReviewRow;
}) {
	const disabled = row.warning !== null;

	return (
		<div className="flex flex-col gap-1 rounded-md border border-border p-2">
			<div className="flex items-center gap-2">
				<Badge className="w-10 shrink-0 justify-center" variant="secondary">
					{row.seatNumber}
				</Badge>
				<SeatCombobox
					allPlayers={allPlayers}
					disabled={disabled}
					heroAvailable={heroAvailable}
					onActionChange={onActionChange}
					onNameChange={onNameChange}
					onSelectExisting={onSelectExisting}
					row={row}
				/>
				<Badge
					className={cn(
						"w-16 shrink-0 justify-center",
						ACTION_BADGE_CLASS[row.action]
					)}
					variant={ACTION_BADGE_VARIANT[row.action]}
				>
					{ACTION_BADGE_LABEL[row.action]}
				</Badge>
			</div>
			{row.warning ? (
				<div className="flex items-start gap-1.5 text-destructive text-xs">
					<IconAlertTriangle className="mt-0.5 shrink-0" size={12} />
					<span>{row.warning}</span>
				</div>
			) : null}
			{row.ambiguous && row.action !== "existing" ? (
				<span className="text-muted-foreground text-xs">
					Multiple players share this name.
				</span>
			) : null}
			{row.action === "hero" && heroAlreadySeatedElsewhere ? (
				<span className="text-muted-foreground text-xs">
					The existing Hero seat will be overwritten.
				</span>
			) : null}
		</div>
	);
}
