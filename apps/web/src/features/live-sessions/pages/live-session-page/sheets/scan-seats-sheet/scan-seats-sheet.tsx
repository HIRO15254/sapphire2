import {
	IconAlertHexagon,
	IconCircleCheck,
	IconLoader2,
	IconPhoto,
	IconRefresh,
} from "@tabler/icons-react";
import type { ScanSeatState } from "@/features/live-sessions/utils/seat-scan-review";
import type { SessionParam } from "@/features/live-sessions/utils/seat-screenshot";
import { ACCEPTED_TYPES } from "@/features/live-sessions/utils/seat-screenshot";
import { CrystSheet } from "../cryst-sheet";
import { ScanReviewRow } from "./scan-review-row";
import type { ScanStep } from "./use-scan-seats-sheet";
import { useScanSeatsSheet } from "./use-scan-seats-sheet";

interface ScanSeatsSheetProps {
	activePlayerIds: readonly string[];
	onOpenChange: (open: boolean) => void;
	open: boolean;
	seats: readonly ScanSeatState[];
	sessionParam: SessionParam;
}

const TITLES: Record<ScanStep, string> = {
	busy: "Reading image",
	choose: "Scan seats",
	done: "Seats registered",
	review: "Check the result",
};

const OUTLINE_BUTTON =
	"min-h-[var(--m-control)] rounded-md border border-border bg-transparent font-semibold text-[length:var(--m-text-secondary)]";
const PRIMARY_BUTTON =
	"min-h-[var(--m-control)] rounded-md bg-primary font-semibold text-[length:var(--m-text-secondary)] text-primary-foreground disabled:opacity-50";

export function ScanSeatsSheet({
	activePlayerIds,
	onOpenChange,
	open,
	seats,
	sessionParam,
}: ScanSeatsSheetProps) {
	const sheet = useScanSeatsSheet({
		activePlayerIds,
		onOpenChange,
		open,
		seats,
		sessionParam,
	});

	let footer = (
		<button
			className={`w-full ${OUTLINE_BUTTON}`}
			onClick={sheet.onCancel}
			type="button"
		>
			Cancel
		</button>
	);
	if (sheet.step === "review") {
		footer = (
			<div className="grid grid-cols-2 gap-2">
				<button
					className={OUTLINE_BUTTON}
					onClick={sheet.onRescan}
					type="button"
				>
					Back
				</button>
				<button
					className={PRIMARY_BUTTON}
					disabled={sheet.selectedCount === 0 || sheet.isApplying}
					onClick={sheet.onCommit}
					type="button"
				>
					{sheet.selectedCount === 0
						? "Register"
						: `Register ${sheet.selectedCount}`}
				</button>
			</div>
		);
	}
	if (sheet.step === "done") {
		footer = (
			<button
				className={`w-full ${PRIMARY_BUTTON}`}
				onClick={sheet.onDone}
				type="button"
			>
				Done
			</button>
		);
	}

	return (
		<CrystSheet
			footer={footer}
			onOpenChange={onOpenChange}
			open={open}
			title={TITLES[sheet.step]}
		>
			<input
				accept={ACCEPTED_TYPES.join(",")}
				className="sr-only"
				onChange={sheet.onImageSelected}
				ref={sheet.fileInputRef}
				type="file"
			/>

			{sheet.step === "choose" ? (
				<div className="flex flex-col gap-3">
					<button
						className={`inline-flex w-full items-center justify-center gap-2 ${PRIMARY_BUTTON}`}
						onClick={sheet.onPickFile}
						type="button"
					>
						<IconPhoto size={17} />
						Choose from library
					</button>
				</div>
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

					<div className="flex max-h-[300px] flex-col overflow-y-auto rounded-md border border-border px-2.5">
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

			{sheet.step === "done" ? (
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2.5 rounded-md bg-[color-mix(in_oklab,var(--success)_12%,transparent)] p-3">
						<IconCircleCheck className="text-success" size={20} />
						<span className="font-semibold text-[length:var(--m-text-secondary)]">
							{sheet.committed.length} seats registered
						</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						{sheet.committed.map((seat) => (
							<span
								className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[length:var(--m-text-caption)]"
								key={seat.seatLabel}
							>
								<span className="font-mono text-muted-foreground">
									{seat.seatLabel}
								</span>
								{seat.name}
							</span>
						))}
					</div>
					<div className="flex flex-col rounded-md border border-border px-2.5 py-0.5 text-[length:var(--text-sm)]">
						<div className="flex justify-between border-border border-b py-2">
							<span className="text-muted-foreground">Kept as they were</span>
							<span className="font-mono">{sheet.keptText}</span>
						</div>
						<div className="flex justify-between py-2">
							<span className="text-muted-foreground">Logged at</span>
							<span className="font-mono">{sheet.committedAtText}</span>
						</div>
					</div>
				</div>
			) : null}
		</CrystSheet>
	);
}
