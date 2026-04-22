import { CashGameCompleteForm } from "@/live-sessions/components/cash-game-complete-form";
import { CashGameStackForm } from "@/live-sessions/components/cash-game-stack-form";
import { TournamentCompleteForm } from "@/live-sessions/components/tournament-complete-form";
import { TournamentStackForm } from "@/live-sessions/components/tournament-stack-form";
import { useActiveSession } from "@/live-sessions/hooks/use-active-session";
import { useCashGameStack } from "@/live-sessions/hooks/use-cash-game-stack";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "@/live-sessions/hooks/use-live-stack-form-sheet";
import { useTournamentStack } from "@/live-sessions/hooks/use-tournament-stack";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";

function CashGameStackSheet({ sessionId }: { sessionId: string }) {
	const {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
		defaultFinalStack,
		setDefaultFinalStack,
	} = useCashGameStackSheet();

	const {
		recordStack,
		addChip,
		removeChip,
		addAllIn,
		addMemo,
		pause,
		complete,
		isStackPending,
		isCompletePending,
	} = useCashGameStack({ sessionId });

	return (
		<>
			<ResponsiveDialog
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<CashGameStackForm
					isLoading={isStackPending}
					onAllIn={(values) => addAllIn(values)}
					onChipAdd={(amount) => addChip(amount)}
					onChipRemove={(amount) => removeChip(amount)}
					onComplete={(currentStack) => {
						setDefaultFinalStack(currentStack);
						setIsCompleteOpen(true);
					}}
					onMemo={(text) => addMemo(text)}
					onPause={() => {
						pause();
						stackSheet.close();
					}}
					onSubmit={(values) => {
						recordStack(values);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					isLoading={isCompletePending}
					onSubmit={(values) => {
						complete(values);
						setIsCompleteOpen(false);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>
		</>
	);
}

function TournamentStackSheet({ sessionId }: { sessionId: string }) {
	const { stackSheet, isCompleteOpen, setIsCompleteOpen } =
		useTournamentStackSheet();

	const {
		chipPurchaseTypes,
		recordStack,
		purchaseChips,
		updateTournamentInfo,
		addMemo,
		pause,
		complete,
		isStackPending,
		isCompletePending,
	} = useTournamentStack({ sessionId });

	return (
		<>
			<ResponsiveDialog
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<TournamentStackForm
					chipPurchaseTypes={chipPurchaseTypes}
					isLoading={isStackPending}
					onComplete={() => {
						setIsCompleteOpen(true);
					}}
					onMemo={(text) => addMemo(text)}
					onPause={() => {
						pause();
						stackSheet.close();
					}}
					onPurchaseChips={(values) => purchaseChips(values)}
					onSubmit={(values) => {
						recordStack({ stackAmount: values.stackAmount });
						if (values.recordTournamentInfo) {
							updateTournamentInfo({
								remainingPlayers: values.remainingPlayers,
								totalEntries: values.totalEntries,
								chipPurchaseCounts: values.chipPurchaseCounts,
							});
						}
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					isLoading={isCompletePending}
					onSubmit={(values) => {
						complete(values);
						setIsCompleteOpen(false);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>
		</>
	);
}

export function LiveStackFormSheet() {
	const { activeSession } = useActiveSession();

	if (!activeSession) {
		return null;
	}

	return activeSession.type === "cash_game" ? (
		<CashGameStackSheet sessionId={activeSession.id} />
	) : (
		<TournamentStackSheet sessionId={activeSession.id} />
	);
}
