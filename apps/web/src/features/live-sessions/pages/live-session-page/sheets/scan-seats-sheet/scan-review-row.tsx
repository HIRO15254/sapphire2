import {
	IconAlertHexagon,
	IconCircle,
	IconCircleCheckFilled,
	IconCircleMinus,
	IconEqual,
	IconHelpCircle,
	IconUserCheck,
	IconUserMinus,
	IconUserPlus,
	IconUserStar,
} from "@tabler/icons-react";
import {
	needsSeatResolution,
	type ScanRow,
	type ScanRowKind,
} from "@/features/live-sessions/utils/seat-scan-review";
import { cn } from "@/lib/utils";
import { NO_INPUT_SUGGESTIONS } from "@/shared/lib/form-fields";

interface ScanRowMeta {
	chip: string;
	icon: typeof IconUserCheck;
	status: string;
}

const ROW_META: Record<ScanRowKind, ScanRowMeta> = {
	conflict: {
		chip: "bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-warning",
		icon: IconAlertHexagon,
		status: "Conflict",
	},
	hero: {
		chip: "bg-muted text-muted-foreground",
		icon: IconUserStar,
		status: "Your seat",
	},
	known: {
		chip: "bg-[color-mix(in_oklab,var(--info)_15%,transparent)] text-info",
		icon: IconUserCheck,
		status: "Known",
	},
	new: {
		chip: "bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary",
		icon: IconUserPlus,
		status: "New",
	},
	none: {
		chip: "bg-muted text-muted-foreground",
		icon: IconHelpCircle,
		status: "Not read",
	},
	occupied: {
		chip: "bg-muted text-muted-foreground",
		icon: IconEqual,
		status: "No change",
	},
	vacate: {
		chip: "bg-[color-mix(in_oklab,var(--warning)_15%,transparent)] text-warning",
		icon: IconUserMinus,
		status: "Left",
	},
};

const PILL_ON =
	"border-primary bg-[color-mix(in_oklab,var(--primary)_15%,transparent)] text-primary";
const PILL_OFF = "border-border bg-transparent text-muted-foreground";

export interface ResolvedScanRow extends ScanRow {
	isSelected: boolean;
}

interface ScanReviewRowProps {
	onNameChange: (seatPosition: number, name: string) => void;
	onToggle: (seatPosition: number, isSelected: boolean) => void;
	row: ResolvedScanRow;
}

export function ScanReviewRow({
	onNameChange,
	onToggle,
	row,
}: ScanReviewRowProps) {
	const meta = ROW_META[row.kind];
	const StatusIcon = meta.icon;
	const seatLabel = `S${row.seatPosition + 1}`;
	let CheckIcon = IconCircleMinus;
	if (row.isSelected) {
		CheckIcon = IconCircleCheckFilled;
	} else if (row.isPickable) {
		CheckIcon = IconCircle;
	}

	return (
		<div className="border-border border-b py-[5px] last:border-b-0">
			<div
				className={cn(
					"grid grid-cols-[26px_28px_minmax(0,1fr)_auto] items-center gap-2",
					row.isPickable || "opacity-55"
				)}
			>
				<button
					aria-label={`${seatLabel}: ${meta.status}`}
					aria-pressed={row.isSelected}
					className={cn(
						"inline-flex size-[26px] items-center justify-center rounded-full",
						row.isSelected ? "text-primary" : "text-muted-foreground",
						row.isPickable || "cursor-not-allowed"
					)}
					disabled={!row.isPickable}
					onClick={() => onToggle(row.seatPosition, !row.isSelected)}
					type="button"
				>
					<CheckIcon size={19} />
				</button>
				<span className="font-mono text-[length:var(--m-text-caption)] text-muted-foreground">
					{seatLabel}
				</span>
				{row.kind === "vacate" ? (
					<span className="min-w-0 truncate px-1.5 text-[length:var(--m-text-footnote)] text-muted-foreground italic">
						Read as empty
					</span>
				) : (
					<input
						aria-label={`Player name at ${seatLabel}`}
						{...NO_INPUT_SUGGESTIONS}
						className="h-[30px] min-w-0 rounded-sm border border-transparent bg-transparent px-1.5 font-medium text-[length:var(--m-text-footnote)] outline-none focus-visible:border-input focus-visible:bg-card"
						disabled={!row.isPickable}
						onChange={(e) => onNameChange(row.seatPosition, e.target.value)}
						type="text"
						value={row.name}
					/>
				)}
				<span
					className={cn(
						"inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[7px] py-0.5 font-semibold text-[11px]",
						meta.chip
					)}
				>
					<StatusIcon size={11} />
					{meta.status}
				</span>
			</div>
			{needsSeatResolution(row) ? (
				<div className="flex items-center gap-1.5 pt-0.5 pb-[5px] pl-[62px]">
					<span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
						Seated now{" "}
						<span className="font-semibold text-foreground">
							{row.currentName}
						</span>
					</span>
					<button
						className={cn(
							"min-h-6 rounded-full border px-[9px] font-semibold text-[11px]",
							row.isSelected ? PILL_OFF : PILL_ON
						)}
						onClick={() => onToggle(row.seatPosition, false)}
						type="button"
					>
						Keep
					</button>
					<button
						className={cn(
							"min-h-6 rounded-full border px-[9px] font-semibold text-[11px]",
							row.isSelected ? PILL_ON : PILL_OFF
						)}
						onClick={() => onToggle(row.seatPosition, true)}
						type="button"
					>
						Replace
					</button>
				</div>
			) : null}
		</div>
	);
}
