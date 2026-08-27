import { ChipPurchaseSheet } from "@/features/live-sessions/components/chip-purchase-sheet";
import { SeatFromScreenshotSheet } from "@/features/live-sessions/components/seat-from-screenshot-sheet";
import { TournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form";
import { BottomSheet } from "@/shared/components/bottom-sheet";
import { CRYST_SCOPE } from "@/shared/lib/theme";
import { ActionBar } from "../action-bar";
import { DiscardDialog } from "../discard-dialog";
import { JoinSeatSheet } from "../join-seat-sheet";
import { MemoFormSheet } from "../memo-form-sheet";
import { PauseOverlay } from "../pause-overlay";
import { PlayerPanel } from "../player-panel";
import { RuleSheet } from "../rule-sheet";
import { SessionHeader } from "../session-header";
import { StackQuickInput } from "../stack-quick-input";
import { TableView } from "../table-view";
import { TimelineSheet } from "../timeline-sheet";
import { BlindLevelBar } from "./blind-level-bar";
import { TournamentTimerDialog } from "./tournament-timer-dialog";
import { useTournamentSessionView } from "./use-tournament-session-view";

const COMPLETE_FORM_ID = "tournament-end-session-form";
const noop = () => undefined;

export function TournamentSession({ sessionId }: { sessionId: string }) {
	const vm = useTournamentSessionView(sessionId);

	if (!vm.session) {
		return null;
	}

	return (
		<>
			<SessionHeader
				isPaused={vm.isPaused}
				menuItems={vm.menuItems}
				onEnd={vm.onEndSession}
				onTitleTap={vm.onOpenRule}
				onTogglePause={vm.onTogglePause}
				startedAt={vm.startedAt}
				title={vm.title}
			/>

			{vm.hasStructure ? (
				<div className="mb-1.5 shrink-0 px-4">
					<BlindLevelBar
						blindLevels={vm.blindLevels}
						isPaused={vm.isPaused}
						onEdit={vm.onOpenTimerDialog}
						timerStartedAt={vm.timerStartedAt}
					/>
				</div>
			) : null}

			<div className="shrink-0 px-3">
				<TableView
					averageStackText={vm.tableCenter.averageStackText}
					bbText={vm.tableCenter.bbText}
					dimmed={vm.isPaused}
					heroSeatPosition={vm.sceneState.heroSeatPosition}
					kind="tournament"
					onEmptySeatTap={vm.onEmptySeatTap}
					onPlayerSeatTap={vm.onPlayerSeatTap}
					onScan={vm.onScanFromTable}
					remainText={vm.tableCenter.remainText}
					seatCount={vm.sceneState.tableSize}
					seatedPlayers={vm.seatedPlayers}
					stackText={vm.tableCenter.stackText}
				/>
			</div>

			<div className="min-h-16 flex-1 overflow-hidden px-[var(--m-inset)] py-2.5">
				<PlayerPanel
					isPaused={vm.isPaused}
					onLeave={vm.onLeavePlayer}
					selection={vm.selection}
				/>
			</div>

			<div className="shrink-0 border-border border-t bg-card">
				<div className="px-[var(--m-inset)] pt-2">
					<StackQuickInput
						defaultRemainingPlayers={vm.defaultRemainingPlayers}
						defaultTotalEntries={vm.defaultTotalEntries}
						disabled={vm.isPaused}
						isPending={vm.isStackPending}
						kind="tournament"
						lastStackUpdatedAt={vm.lastStackUpdatedAt}
						onRecordStack={vm.handleRecordStack}
					/>
				</div>
				<ActionBar
					dimmed={vm.isPaused}
					kind="tournament"
					onAllIn={noop}
					onChips={noop}
					onNote={vm.onOpenMemo}
					onPurchase={vm.onOpenBuyChips}
					onTimeline={vm.onOpenTimeline}
				/>
			</div>

			{vm.isPaused ? (
				<PauseOverlay
					elapsedText={vm.pausedElapsedText}
					onNote={vm.onOpenMemo}
					onResume={vm.onResume}
				/>
			) : null}

			{vm.hasStructure ? (
				<TournamentTimerDialog
					isLoading={vm.isUpdatingTimer}
					onClear={vm.handleClearTimer}
					onOpenChange={vm.setIsTimerDialogOpen}
					onSubmit={vm.handleSubmitTimer}
					open={vm.isTimerDialogOpen}
					timerStartedAt={vm.timerStartedAt}
				/>
			) : null}

			<ChipPurchaseSheet
				contentClassName={CRYST_SCOPE}
				onOpenChange={vm.setIsBuyChipsOpen}
				onSubmit={vm.handleBuyChipsSubmit}
				open={vm.isBuyChipsOpen}
				options={vm.chipPurchaseTypes}
			/>

			<MemoFormSheet
				onOpenChange={vm.setIsMemoOpen}
				onSubmit={vm.handleMemoSubmit}
				open={vm.isMemoOpen}
			/>

			<JoinSeatSheet
				excludePlayerIds={vm.sceneState.excludePlayerIds}
				heroAvailable={vm.sceneState.heroAvailable}
				onOpenChange={(open) => {
					if (!open) {
						vm.onCloseJoin();
					}
				}}
				onScan={vm.onScanFromJoin}
				onSeatExisting={vm.sceneState.onSeatExisting}
				onSeatHero={vm.sceneState.onSeatHero}
				onSeatNew={vm.sceneState.onSeatNew}
				onSeatTemporary={vm.sceneState.onSeatTemporary}
				open={vm.joinSeatPosition !== null}
				seatPosition={vm.joinSeatPosition}
			/>

			<TimelineSheet
				onOpenChange={vm.setIsTimelineOpen}
				open={vm.isTimelineOpen}
				sessionId={sessionId}
				sessionType="tournament"
			/>

			<RuleSheet onOpenChange={vm.setIsRuleOpen} open={vm.isRuleOpen} />

			<SeatFromScreenshotSheet
				heroSeatPosition={vm.sceneState.heroSeatPosition}
				occupiedSeatPositions={vm.sceneState.occupiedSeatPositions}
				onOpenChange={vm.setIsScanOpen}
				open={vm.isScanOpen}
				sessionParam={vm.sceneState.sessionParam}
				sheetClassName={CRYST_SCOPE}
				tableSize={vm.sceneState.tableSize}
			/>

			<BottomSheet
				cancelLabel="Cancel"
				confirmLabel="End and save"
				formId={COMPLETE_FORM_ID}
				isConfirmPending={vm.isCompletePending}
				onOpenChange={vm.setIsCompleteOpen}
				open={vm.isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					formId={COMPLETE_FORM_ID}
					onSubmit={vm.handleCompleteSubmit}
				/>
			</BottomSheet>

			<DiscardDialog
				isOpen={vm.isDiscardOpen}
				isPending={vm.isDiscardPending}
				onClose={vm.onCloseDiscard}
				onConfirm={vm.discard}
			/>
		</>
	);
}
