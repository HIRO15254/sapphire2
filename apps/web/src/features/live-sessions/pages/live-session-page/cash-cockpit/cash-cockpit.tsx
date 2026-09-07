import { ActionBar } from "../action-bar";
import { PausedOverlay } from "../paused-overlay";
import { SeatPanel } from "../seat-panel";
import { SeatPanelPlaceholder } from "../seat-panel-placeholder";
import { SelectedPlayerPanel } from "../selected-player-panel";
import { SessionHeader } from "../session-header";
import {
	EndSessionSheet,
	EventEditorSheet,
	ScanSeatsSheet,
	SitInSheet,
	TimelineSheet,
} from "../sheets";
import { StackQuickInput } from "../stack-quick-input";
import { StalenessLine } from "../staleness-line";
import { TableView } from "../table-view";
import { CashTableStats } from "./cash-table-stats";
import { useCashCockpit } from "./use-cash-cockpit";

export function CashCockpit({ sessionId }: { sessionId: string }) {
	const cockpit = useCashCockpit(sessionId);

	if (cockpit.isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center p-4 text-muted-foreground text-sm">
				Loading session...
			</div>
		);
	}

	const { journal } = cockpit;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<SessionHeader
				elapsed={cockpit.elapsed}
				isMasterLinked={cockpit.isMasterLinked}
				isPaused={cockpit.isPaused}
				onEndSession={cockpit.onEndSession}
				onPause={cockpit.onPause}
				onResume={cockpit.onResume}
				ruleName={cockpit.ruleName}
			/>
			<div className="relative flex min-h-0 flex-1 flex-col">
				{cockpit.isKeyboardOpen ? null : (
					<TableView
						center={
							<CashTableStats
								bbText={cockpit.bbText}
								displayPL={cockpit.displayPL}
								displayPLFormatted={cockpit.displayPLFormatted}
								evPLFormatted={cockpit.evPLFormatted}
								stackFormatted={cockpit.stackFormatted}
							/>
						}
						onScan={cockpit.onOpenScan}
						onSelectSeat={cockpit.onSelectSeat}
						seats={cockpit.seats}
						selectedSeatPosition={cockpit.selectedSeatPosition}
					/>
				)}
				<SeatPanel>
					{cockpit.selectedPlayerId === null ||
					cockpit.selectedSeatPosition === null ? (
						<SeatPanelPlaceholder />
					) : (
						<SelectedPlayerPanel
							onLeave={cockpit.onLeaveSeat}
							playerId={cockpit.selectedPlayerId}
							seatLabel={`S${cockpit.selectedSeatPosition + 1}`}
						/>
					)}
				</SeatPanel>
				<div className="shrink-0 border-border border-t bg-card">
					<div className="flex flex-col gap-1.5 px-[var(--m-inset)] pt-2">
						<StackQuickInput
							currentStack={cockpit.defaultFinalStack ?? null}
							isDisabled={!cockpit.canRecordStack}
							isPending={cockpit.isStackPending}
							onSubmit={cockpit.onRecordStack}
						/>
						<StalenessLine
							referenceLabel={cockpit.referenceLabel}
							source={cockpit.stalenessSource}
							staleness={cockpit.staleness}
						/>
					</div>
					<ActionBar
						canLog={journal.canLog}
						onOpenNewEvent={journal.onOpenNewEvent}
						onOpenTimeline={journal.onOpenTimeline}
						variant="cash"
					/>
				</div>
				{cockpit.isPaused ? (
					<PausedOverlay
						onNote={() => journal.onOpenNewEvent("memo")}
						onResume={cockpit.onResume}
						pausedElapsed={cockpit.pausedElapsed}
					/>
				) : null}
			</div>
			{cockpit.sitInSeatPosition === null ? null : (
				<SitInSheet
					excludePlayerIds={cockpit.excludePlayerIds}
					heroSeatPosition={cockpit.heroSeatPosition}
					onOpenChange={cockpit.onCloseSeatSheet}
					onOpenScan={cockpit.onOpenScan}
					onSeatExisting={cockpit.onSitInExisting}
					onSeatHero={cockpit.onSitInHero}
					onSeatNew={cockpit.onSitInNew}
					open={cockpit.seatSheet === "sitIn"}
					seatPosition={cockpit.sitInSeatPosition}
				/>
			)}
			<ScanSeatsSheet
				onOpenChange={cockpit.onCloseSeatSheet}
				open={cockpit.seatSheet === "scan"}
				seats={cockpit.scanSeats}
				sessionParam={cockpit.sessionParam}
			/>
			<EndSessionSheet
				chipRemoveTotal={cockpit.chipRemoveTotal}
				defaultFinalStack={cockpit.defaultFinalStack}
				evDiff={cockpit.evDiff}
				isPending={cockpit.isCompletePending}
				onOpenChange={cockpit.onEndSessionOpenChange}
				onSubmit={cockpit.onCompleteSubmit}
				open={cockpit.isEndSessionOpen}
				totalBuyIn={cockpit.totalBuyIn}
			/>
			<TimelineSheet
				onOpenChange={journal.onCloseTimeline}
				onSelect={journal.onSelectEvent}
				open={journal.isTimelineOpen}
				rows={journal.rows}
				sessionId={sessionId}
				sessionType="cash_game"
			/>
			{journal.editorTarget === null ? null : (
				<EventEditorSheet
					chipPurchaseOptions={journal.chipPurchaseOptions}
					isPending={journal.isEditorPending}
					isTournament={false}
					maxTime={journal.maxTime}
					minTime={journal.minTime}
					onDelete={journal.onDelete}
					onOpenChange={journal.onCloseEditor}
					onSubmit={journal.onEditorSubmit}
					open={journal.isEditorOpen}
					playerNames={journal.playerNames}
					seatCount={journal.seatCount}
					target={journal.editorTarget}
				/>
			)}
		</div>
	);
}
