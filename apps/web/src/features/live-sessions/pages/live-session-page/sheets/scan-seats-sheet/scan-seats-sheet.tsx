import {
	IconAlertTriangle,
	IconLoader2,
	IconPhoto,
	IconRefresh,
} from "@tabler/icons-react";
import type { SeatPlanStep } from "@/features/live-sessions/utils/seat-plan";
import type { ScanSeatState } from "@/features/live-sessions/utils/seat-scan-review";
import { ACCEPTED_TYPES } from "@/features/live-sessions/utils/seat-screenshot";
import { cn } from "@/lib/utils";
import { CRYST_ALERT, crystButton } from "../../cryst-controls";
import { CrystFormSheet } from "../cryst-form-sheet";
import { ScanReviewRow } from "./scan-review-row";
import type { ScanStep } from "./use-scan-seats-sheet";
import { useScanSeatsSheet } from "./use-scan-seats-sheet";

interface ScanSeatsSheetProps {
	activePlayerIds: readonly string[];
	onApplySeatPlan: (steps: readonly SeatPlanStep[]) => Promise<number>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	seats: readonly ScanSeatState[];
}

const FORM_ID = "cryst-scan-seats-form";

const TITLES: Record<ScanStep, string> = {
	busy: "Reading images",
	choose: "Scan seats",
	review: "Check the result",
};

export function ScanSeatsSheet({
	activePlayerIds,
	onApplySeatPlan,
	onOpenChange,
	open,
	seats,
}: ScanSeatsSheetProps) {
	const sheet = useScanSeatsSheet({
		activePlayerIds,
		onApplySeatPlan,
		onOpenChange,
		open,
		seats,
	});

	const isSaveDisabled =
		sheet.step === "choose" ||
		sheet.step === "busy" ||
		(sheet.step === "review" && sheet.selectedCount === 0);

	return (
		<CrystFormSheet
			formId={FORM_ID}
			isLoading={sheet.isApplying}
			isSaveDisabled={isSaveDisabled}
			onOpenChange={onOpenChange}
			open={open}
			title={TITLES[sheet.step]}
		>
			<form
				className="flex flex-col gap-3"
				id={FORM_ID}
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (sheet.step === "review") {
						sheet.onCommit();
					}
				}}
			>
				<input
					accept={ACCEPTED_TYPES.join(",")}
					className="sr-only"
					multiple
					onChange={sheet.onImageSelected}
					ref={sheet.fileInputRef}
					type="file"
				/>

				{sheet.step === "choose" ? (
					<button
						className={cn(crystButton({ variant: "primary" }), "w-full")}
						onClick={sheet.onPickFile}
						type="button"
					>
						<IconPhoto size={18} />
						Choose from library
					</button>
				) : null}

				{sheet.step === "busy" ? (
					<div className="flex min-h-[140px] flex-col items-center justify-center gap-2.5 text-muted-foreground">
						<IconLoader2 className="animate-spin" size={24} />
						<span className="text-[length:var(--text-sm)]">
							Detecting seat numbers and names...
						</span>
					</div>
				) : null}

				{sheet.step === "review" ? (
					<div className="flex flex-col gap-2.5">
						<div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5">
							<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
								<IconPhoto size={18} />
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="font-semibold text-[length:var(--text-sm)]">
									{sheet.scannedAtText}
								</span>
								<span className="font-mono text-[length:var(--text-xs)] text-muted-foreground">
									{sheet.detectedText}
								</span>
							</span>
							<button
								className={crystButton({ size: "sm", variant: "outline" })}
								onClick={sheet.onRescan}
								type="button"
							>
								<IconRefresh size={14} />
								Re-scan
							</button>
						</div>

						<div className="flex items-center gap-2">
							<span className="min-w-0 flex-1 text-[length:var(--text-xs)] text-muted-foreground">
								{sheet.summaryText}
							</span>
							<button
								className={crystButton({ size: "sm", variant: "ghost" })}
								onClick={sheet.onToggleAll}
								type="button"
							>
								{sheet.selectAllLabel}
							</button>
						</div>

						{sheet.conflictNote === null ? null : (
							<p
								className={cn(
									CRYST_ALERT,
									"grid grid-cols-[auto_1fr] gap-2.5 px-3.5 py-3"
								)}
								role="alert"
							>
								<IconAlertTriangle className="mt-px text-warning" size={16} />
								<span className="text-pretty">{sheet.conflictNote}</span>
							</p>
						)}

						<div className="flex flex-col rounded-lg border border-border bg-card px-2.5">
							{sheet.rows.map((row) => (
								<ScanReviewRow
									key={row.seatPosition}
									onNameChange={sheet.onNameChange}
									onToggle={sheet.onToggleRow}
									row={row}
								/>
							))}
						</div>
					</div>
				) : null}
			</form>
		</CrystFormSheet>
	);
}
