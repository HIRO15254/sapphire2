import { ActionsDrawer } from "@/features/live-sessions/components/actions-drawer";
import { AddonBottomSheet } from "@/features/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/features/live-sessions/components/all-in-bottom-sheet";
import { CashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form";
import { SeatFromScreenshotSheet } from "@/features/live-sessions/components/seat-from-screenshot-sheet";
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
import { useCashGameSessionView } from "./use-cash-game-session-view";

const COMPLETE_FORM_ID = "cash-game-end-session-form";
const noop = () => undefined;

export function CashGameSession({ sessionId }: { sessionId: string }) {
	const vm = useCashGameSessionView(sessionId);

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

			<div className="shrink-0 px-3">
				<TableView
					bbText={vm.tableCenter.bbText}
					deltaText={vm.tableCenter.deltaText}
					deltaTone={vm.tableCenter.deltaTone}
					dimmed={vm.isPaused}
					evText={vm.tableCenter.evText}
					heroSeatPosition={vm.sceneState.heroSeatPosition}
					kind="cash_game"
					onEmptySeatTap={vm.onEmptySeatTap}
					onPlayerSeatTap={vm.onPlayerSeatTap}
					onScan={vm.onScanFromTable}
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
						disabled={vm.isPaused}
						isPending={vm.isStackPending}
						kind="cash_game"
						lastStackUpdatedAt={vm.lastStackUpdatedAt}
						onRecordStack={vm.handleRecordStack}
					/>
				</div>
				<ActionBar
					dimmed={vm.isPaused}
					kind="cash_game"
					onAllIn={vm.onOpenAllIn}
					onChips={vm.onOpenChipMenu}
					onNote={vm.onOpenMemo}
					onPurchase={noop}
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

			<ActionsDrawer
				contentClassName={CRYST_SCOPE}
				description="Add or withdraw chips."
				items={vm.chipMenuItems}
				onOpenChange={vm.setIsChipMenuOpen}
				open={vm.isChipMenuOpen}
				title="Chip adjust"
			/>

			<AllInBottomSheet
				onOpenChange={vm.setIsAllInOpen}
				onSubmit={vm.handleAllInSubmit}
				open={vm.isAllInOpen}
				sheetClassName={CRYST_SCOPE}
			/>

			<AddonBottomSheet
				onOpenChange={vm.setIsAddChipsOpen}
				onSubmit={vm.handleAddChipsSubmit}
				open={vm.isAddChipsOpen}
				sheetClassName={CRYST_SCOPE}
			/>

			<AddonBottomSheet
				onOpenChange={vm.setIsRemoveChipsOpen}
				onSubmit={vm.handleRemoveChipsSubmit}
				open={vm.isRemoveChipsOpen}
				sheetClassName={CRYST_SCOPE}
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
				sessionType="cash_game"
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
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultFinalStack={vm.defaultFinalStack}
					formId={COMPLETE_FORM_ID}
					onSubmit={vm.handleCompleteSubmit}
					previewInput={vm.completePreviewInput}
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
