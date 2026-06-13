import { ActiveSessionScene } from "@/features/live-sessions/components/active-session-scene";
import { AddonBottomSheet } from "@/features/live-sessions/components/addon-bottom-sheet";
import { AllInBottomSheet } from "@/features/live-sessions/components/all-in-bottom-sheet";
import { CashGameCompleteForm } from "@/features/live-sessions/components/cash-game-complete-form";
import { FormSheet } from "@/shared/components/form-sheet";
import { CashGameCompactSummary } from "../cash-game-compact-summary";
import { MemoFormSheet } from "../memo-form-sheet";
import { useCashGameSessionView } from "./use-cash-game-session-view";

const COMPLETE_FORM_ID = "cash-game-end-session-form";

export function CashGameSession({ sessionId }: { sessionId: string }) {
	const {
		defaultFinalStack,
		discard,
		eventMenuExtraItems,
		handleAddChipsSubmit,
		handleAllInSubmit,
		handleCompleteSubmit,
		handleMemoSubmit,
		handleRemoveChipsSubmit,
		isAddChipsOpen,
		isAllInOpen,
		isCompleteOpen,
		isCompletePending,
		isDiscardPending,
		isMemoOpen,
		isRemoveChipsOpen,
		onEndSession,
		onPause,
		sceneState,
		session,
		setIsAddChipsOpen,
		setIsAllInOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRemoveChipsOpen,
		summary,
	} = useCashGameSessionView(sessionId);

	if (!(session && summary)) {
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
				summary={<CashGameCompactSummary summary={summary} />}
				title="Cash Game"
			/>

			<AllInBottomSheet
				onOpenChange={setIsAllInOpen}
				onSubmit={handleAllInSubmit}
				open={isAllInOpen}
			/>

			<AddonBottomSheet
				onOpenChange={setIsAddChipsOpen}
				onSubmit={handleAddChipsSubmit}
				open={isAddChipsOpen}
			/>

			<AddonBottomSheet
				onOpenChange={setIsRemoveChipsOpen}
				onSubmit={handleRemoveChipsSubmit}
				open={isRemoveChipsOpen}
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
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					formId={COMPLETE_FORM_ID}
					onSubmit={handleCompleteSubmit}
				/>
			</FormSheet>
		</>
	);
}
