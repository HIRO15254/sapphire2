import {
	IconAlertTriangle,
	IconCheck,
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
import {
	CRYST_BADGE,
	CRYST_BADGE_TONE,
	CRYST_FOCUS_RING,
	CRYST_INLINE_FIELD,
} from "../../cryst-controls";

interface ScanRowMeta {
	chip: string;
	icon: typeof IconUserCheck;
	status: string;
}

const ROW_META: Record<ScanRowKind, ScanRowMeta> = {
	conflict: {
		chip: CRYST_BADGE_TONE.warning,
		icon: IconAlertTriangle,
		status: "Conflict",
	},
	hero: {
		chip: CRYST_BADGE_TONE.neutral,
		icon: IconUserStar,
		status: "Your seat",
	},
	known: {
		chip: CRYST_BADGE_TONE.info,
		icon: IconUserCheck,
		status: "Known",
	},
	new: {
		chip: CRYST_BADGE_TONE.primary,
		icon: IconUserPlus,
		status: "New",
	},
	none: {
		chip: CRYST_BADGE_TONE.neutral,
		icon: IconHelpCircle,
		status: "Not read",
	},
	occupied: {
		chip: CRYST_BADGE_TONE.neutral,
		icon: IconEqual,
		status: "No change",
	},
	vacate: {
		chip: CRYST_BADGE_TONE.warning,
		icon: IconUserMinus,
		status: "Left",
	},
};

const PILL = `min-h-6 rounded-full border px-[9px] font-medium text-[length:var(--text-xs)] transition-colors ${CRYST_FOCUS_RING}`;
const PILL_ON = "border-primary bg-[var(--selection)] text-primary";
const PILL_OFF =
	"border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground";

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
						"group inline-flex size-[26px] items-center justify-center rounded-md outline-none",
						row.isPickable || "cursor-not-allowed"
					)}
					disabled={!row.isPickable}
					onClick={() => onToggle(row.seatPosition, !row.isSelected)}
					type="button"
				>
					<span
						className={cn(
							"inline-flex size-5 items-center justify-center rounded-md border transition-colors group-focus-visible:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]",
							row.isSelected
								? "border-primary bg-primary text-primary-foreground"
								: "border-input bg-card text-transparent"
						)}
					>
						<IconCheck size={14} stroke={3} />
					</span>
				</button>
				<span className="font-mono text-[length:var(--text-xs)] text-muted-foreground">
					{seatLabel}
				</span>
				{row.kind === "vacate" ? (
					<span className="min-w-0 truncate px-1.5 text-[length:var(--text-sm)] text-muted-foreground italic">
						Read as empty
					</span>
				) : (
					<input
						aria-label={`Player name at ${seatLabel}`}
						{...NO_INPUT_SUGGESTIONS}
						className={cn(
							CRYST_INLINE_FIELD,
							"h-[30px] min-w-0 px-1.5 font-medium text-[length:var(--text-sm)] disabled:hover:bg-transparent"
						)}
						disabled={!row.isPickable}
						onChange={(e) => onNameChange(row.seatPosition, e.target.value)}
						type="text"
						value={row.name}
					/>
				)}
				<span className={cn(CRYST_BADGE, meta.chip)}>
					<StatusIcon size={12} />
					{meta.status}
				</span>
			</div>
			{needsSeatResolution(row) ? (
				<div className="flex items-center gap-1.5 pt-0.5 pb-[5px] pl-[62px]">
					<span className="min-w-0 flex-1 truncate text-[length:var(--text-xs)] text-muted-foreground">
						Seated now{" "}
						<span className="font-semibold text-foreground">
							{row.currentName}
						</span>
					</span>
					<button
						className={cn(PILL, row.isSelected ? PILL_OFF : PILL_ON)}
						onClick={() => onToggle(row.seatPosition, false)}
						type="button"
					>
						Keep
					</button>
					<button
						className={cn(PILL, row.isSelected ? PILL_ON : PILL_OFF)}
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
