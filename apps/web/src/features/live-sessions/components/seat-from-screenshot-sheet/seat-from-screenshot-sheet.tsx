import { TABLE_PLAYER_SOURCE_APPS } from "@sapphire2/api/routers/ai-extract-sources";
import { IconLoader2, IconPhotoUp, IconSparkles } from "@tabler/icons-react";
import {
	type SessionParam,
	SOURCE_APP_ENTRIES,
} from "@/features/live-sessions/utils/seat-screenshot";
import { SessionFormSheet } from "@/features/sessions/components/session-form-sheet";
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { ReviewRowItem } from "./review-row-item";
import { useSeatFromScreenshot } from "./use-seat-from-screenshot";

interface SeatFromScreenshotSheetProps {
	heroSeatPosition: number | null;
	occupiedSeatPositions: Set<number>;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	sessionParam: SessionParam;
	tableSize: number;
}

export function SeatFromScreenshotSheet({
	heroSeatPosition,
	occupiedSeatPositions,
	onOpenChange,
	open,
	sessionParam,
	tableSize,
}: SeatFromScreenshotSheetProps) {
	const {
		step,
		sourceApp,
		rows,
		isApplying,
		fileInputRef,
		isExtracting,
		allPlayers,
		onSourceAppSelect,
		onPickFile,
		onImageSelected,
		onRowNameChange,
		onRowSelectExisting,
		onRowActionChange,
		onApply,
		onBackToSelectApp,
		onBackToUpload,
	} = useSeatFromScreenshot({
		occupiedSeatPositions,
		onOpenChange,
		open,
		sessionParam,
		seatCount: tableSize,
	});

	const renderStep = () => {
		if (step === "select-app") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Choose the app the screenshot came from.
					</p>
					<div className="flex flex-col gap-2">
						{SOURCE_APP_ENTRIES.map(([id, config]) => (
							<Button
								key={id}
								onClick={() => onSourceAppSelect(id)}
								type="button"
								variant="outline"
							>
								{config.label}
							</Button>
						))}
					</div>
					<DialogActionRow>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="outline"
						>
							Cancel
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (step === "upload") {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						Upload a screenshot from{" "}
						<span className="font-medium text-foreground">
							{TABLE_PLAYER_SOURCE_APPS[sourceApp].label}
						</span>
						.
					</p>
					<Button disabled={isExtracting} onClick={onPickFile} type="button">
						{isExtracting ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Analyzing...
							</>
						) : (
							<>
								<IconPhotoUp size={16} />
								Choose screenshot
							</>
						)}
					</Button>
					<input
						accept="image/jpeg,image/png,image/gif,image/webp"
						className="hidden"
						onChange={onImageSelected}
						ref={fileInputRef}
						type="file"
					/>
					<DialogActionRow>
						<Button
							disabled={isExtracting}
							onClick={onBackToSelectApp}
							type="button"
							variant="outline"
						>
							Back
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		if (rows.length === 0) {
			return (
				<div className="flex flex-col gap-3">
					<p className="text-muted-foreground text-sm">
						No players detected in the screenshot.
					</p>
					<DialogActionRow>
						<Button onClick={onBackToUpload} type="button" variant="outline">
							Try another image
						</Button>
						<Button
							onClick={() => onOpenChange(false)}
							type="button"
							variant="ghost"
						>
							Close
						</Button>
					</DialogActionRow>
				</div>
			);
		}

		const seatablesCount = rows.filter(
			(row) => row.action !== "skip" && row.warning === null
		).length;
		const heroAssignedRowId =
			rows.find((r) => r.action === "hero")?.rowId ?? null;

		return (
			<div className="flex flex-col gap-3">
				<p className="text-muted-foreground text-sm">
					Detected {rows.length} {rows.length === 1 ? "seat" : "seats"}. Review
					each row, then press Apply.
				</p>
				<div className="flex flex-col gap-2">
					{rows.map((row) => (
						<ReviewRowItem
							allPlayers={allPlayers}
							heroAlreadySeatedElsewhere={
								heroSeatPosition !== null &&
								heroSeatPosition !== row.seatPosition
							}
							heroAvailable={
								heroAssignedRowId === null || heroAssignedRowId === row.rowId
							}
							key={row.rowId}
							onActionChange={(next) => onRowActionChange(row.rowId, next)}
							onNameChange={(next) => onRowNameChange(row.rowId, next)}
							onSelectExisting={(player) =>
								onRowSelectExisting(row.rowId, player)
							}
							row={row}
						/>
					))}
				</div>
				<DialogActionRow>
					<Button
						disabled={isApplying}
						onClick={onBackToUpload}
						type="button"
						variant="outline"
					>
						Try another image
					</Button>
					<Button
						disabled={isApplying || seatablesCount === 0}
						onClick={onApply}
						type="button"
					>
						{isApplying ? (
							<>
								<IconLoader2 className="animate-spin" size={16} />
								Applying...
							</>
						) : (
							<>
								<IconSparkles size={16} />
								Apply ({seatablesCount})
							</>
						)}
					</Button>
				</DialogActionRow>
			</div>
		);
	};

	return (
		<SessionFormSheet
			onOpenChange={onOpenChange}
			open={open}
			title="Seat from screenshot"
		>
			{renderStep()}
		</SessionFormSheet>
	);
}
