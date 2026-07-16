import { ActiveSessionScene } from "@/features/live-sessions/components/active-session-scene";
import { ChipPurchaseSheet } from "@/features/live-sessions/components/chip-purchase-sheet";
import { TournamentCompleteForm } from "@/features/live-sessions/components/tournament-complete-form";
import { VirtualAmountSheet } from "@/features/live-sessions/components/virtual-amount-sheet";
import { FormSheet } from "@/shared/components/form-sheet";
import { MemoFormSheet } from "../memo-form-sheet";
import { TournamentCompactSummary } from "../tournament-compact-summary";
import { TournamentTimer } from "./tournament-timer";
import { TournamentTimerDialog } from "./tournament-timer-dialog";
import { useTournamentSessionView } from "./use-tournament-session-view";

const COMPLETE_FORM_ID = "tournament-end-session-form";

export function TournamentSession({ sessionId }: { sessionId: string }) {
	const {
		blindLevels,
		chipPurchaseTypes,
		discard,
		eventMenuExtraItems,
		handleBuyChipsSubmit,
		handleClearTimer,
		handleCompleteSubmit,
		handleMemoSubmit,
		handleOpenTimerDialog,
		handleSubmitTimer,
		handleVirtualBuyInSubmit,
		handleVirtualCashOutSubmit,
		hasStructure,
		isBuyChipsOpen,
		isCompleteOpen,
		isCompletePending,
		isDiscardPending,
		isMemoOpen,
		isTimerDialogOpen,
		isUpdatingTimer,
		isVirtualBuyInOpen,
		isVirtualCashOutOpen,
		onEndSession,
		onPause,
		sceneState,
		session,
		setIsBuyChipsOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsTimerDialogOpen,
		setIsVirtualBuyInOpen,
		setIsVirtualCashOutOpen,
		timerStartedAt,
		tournamentSummary,
		virtualItems,
	} = useTournamentSessionView(sessionId);

	if (!(session && tournamentSummary)) {
		return null;
	}

	return (
		<>
			<ActiveSessionScene
				eventMenuExtraItems={eventMenuExtraItems}
				isDiscardPending={isDiscardPending}
				memo={session.memo}
				onDiscard={discard}
				onEndSession={onEndSession}
				onPause={onPause}
				state={sceneState}
				summary={
					<TournamentCompactSummary
						summary={{
							...tournamentSummary,
							startedAt: session.startedAt ?? new Date(),
						}}
					/>
				}
				title="Tournament"
				topSlot={
					hasStructure ? (
						<TournamentTimer
							blindLevels={blindLevels}
							onEditTimer={handleOpenTimerDialog}
							timerStartedAt={timerStartedAt}
						/>
					) : undefined
				}
			/>

			{hasStructure ? (
				<TournamentTimerDialog
					isLoading={isUpdatingTimer}
					onClear={handleClearTimer}
					onOpenChange={setIsTimerDialogOpen}
					onSubmit={handleSubmitTimer}
					open={isTimerDialogOpen}
					timerStartedAt={timerStartedAt}
				/>
			) : null}

			<ChipPurchaseSheet
				onOpenChange={setIsBuyChipsOpen}
				onSubmit={handleBuyChipsSubmit}
				open={isBuyChipsOpen}
				options={chipPurchaseTypes}
			/>

			<VirtualAmountSheet
				formId="tournament-virtual-buy-in-form"
				items={virtualItems}
				onOpenChange={setIsVirtualBuyInOpen}
				onSubmit={handleVirtualBuyInSubmit}
				open={isVirtualBuyInOpen}
				title="Virtual buy-in"
			/>

			<VirtualAmountSheet
				formId="tournament-virtual-cash-out-form"
				items={virtualItems}
				onOpenChange={setIsVirtualCashOutOpen}
				onSubmit={handleVirtualCashOutSubmit}
				open={isVirtualCashOutOpen}
				title="Virtual cash-out"
			/>

			<MemoFormSheet
				onOpenChange={setIsMemoOpen}
				onSubmit={handleMemoSubmit}
				open={isMemoOpen}
			/>

			<FormSheet
				formId={COMPLETE_FORM_ID}
				isLoading={isCompletePending}
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					formId={COMPLETE_FORM_ID}
					onSubmit={handleCompleteSubmit}
				/>
			</FormSheet>
		</>
	);
}
