import {
	IconAlertHexagon,
	IconLoader2,
	IconPhoto,
	IconRefresh,
} from "@tabler/icons-react";
import type { ScanPlanStep } from "@/features/live-sessions/utils/seat-scan-plan";
import type { ScanSeatState } from "@/features/live-sessions/utils/seat-scan-review";
import { ACCEPTED_TYPES } from "@/features/live-sessions/utils/seat-screenshot";
import { CrystFormSheet } from "../cryst-form-sheet";
import { ScanReviewRow } from "./scan-review-row";
import type { ScanStep } from "./use-scan-seats-sheet";
import { useScanSeatsSheet } from "./use-scan-seats-sheet";

interface ScanSeatsSheetProps {
	activePlayerIds: readonly string[];
	onApplyScan: (steps: readonly ScanPlanStep[]) => Promise<number>;
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

const PRIMARY_BUTTON =
	"min-h-[var(--m-control)] rounded-md bg-primary font-semibold text-[length:var(--m-text-secondary)] text-primary-foreground disabled:opacity-50";

export function ScanSeatsSheet({
	activePlayerIds,
	onApplyScan,
	onOpenChange,
	open,
	seats,
}: ScanSeatsSheetProps) {
	const sheet = useScanSeatsSheet({
		activePlayerIds,
		onApplyScan,
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
						className={`inline-flex w-full items-center justify-center gap-2 ${PRIMARY_BUTTON}`}
						onClick={sheet.onPickFile}
						type="button"
					>
						<IconPhoto size={17} />
						Choose from library
					</button>
				) : null}

				{sheet.step === "busy" ? (
					<div className="flex min-h-[140px] flex-col items-center justify-center gap-2.5 text-muted-foreground">
						<IconLoader2 className="animate-spin text-primary" size={24} />
						<span className="text-[length:var(--m-text-footnote)]">
							Detecting seat numbers and names...
						</span>
					</div>
				) : null}

				{sheet.step === "review" ? (
					<div className="flex flex-col gap-2.5">
						<div className="flex items-center gap-2.5 rounded-md border border-border p-2.5">
							<span className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
								<IconPhoto size={18} />
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="font-semibold text-[length:var(--m-text-footnote)]">
									{sheet.scannedAtText}
								</span>
								<span className="font-mono text-[length:var(--m-text-caption)] text-muted-foreground">
									{sheet.detectedText}
								</span>
							</span>
							<button
								className="inline-flex min-h-7 items-center gap-1 rounded-md border border-border px-2 text-[length:var(--text-xs)]"
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
								className="min-h-[26px] rounded-md px-2 font-semibold text-[length:var(--text-xs)] text-primary"
								onClick={sheet.onToggleAll}
								type="button"
							>
								{sheet.selectAllLabel}
							</button>
						</div>

						{sheet.conflictNote === null ? null : (
							<p className="flex items-start gap-[7px] rounded-md bg-[color-mix(in_oklab,var(--warning)_12%,transparent)] px-2.5 py-2 text-[length:var(--text-xs)] text-warning">
								<IconAlertHexagon className="mt-px shrink-0" size={14} />
								<span className="text-pretty">{sheet.conflictNote}</span>
							</p>
						)}

						<div className="flex flex-col rounded-md border border-border px-2.5">
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
