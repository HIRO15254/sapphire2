import { CompleteSessionForm } from "@/features/live-sessions/components/complete-session-form";
import { StackForm } from "@/features/live-sessions/components/stack-form";
import { useActiveSession } from "@/features/live-sessions/hooks/use-active-session";
import { useStackRecord } from "@/features/live-sessions/hooks/use-stack-record";
import { ResponsiveDialog } from "@/shared/components/ui/responsive-dialog";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "./use-live-stack-form-sheet";

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
		completeCash,
		isStackPending,
		isCompletePending,
	} = useStackRecord({ sessionId, kind: "cash_game" });

	return (
		<>
			<ResponsiveDialog
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<StackForm
					isLoading={isStackPending}
					kind="cash_game"
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
						recordStack({ stackAmount: values.stackAmount });
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CompleteSessionForm
					defaultFinalStack={defaultFinalStack}
					isLoading={isCompletePending}
					kind="cash_game"
					onSubmit={(values) => {
						completeCash(values as { finalStack: number });
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
		chipPurchaseOptions,
		recordStack,
		purchaseChips,
		addMemo,
		pause,
		completeTournament,
		isStackPending,
		isCompletePending,
	} = useStackRecord({ sessionId, kind: "tournament" });

	const chipPurchaseTypes = chipPurchaseOptions.map((o) => ({
		id: o.id,
		name: o.name,
		cost: o.cost,
		chips: o.chips,
	}));

	return (
		<>
			<ResponsiveDialog
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<StackForm
					chipPurchaseTypes={chipPurchaseTypes}
					isLoading={isStackPending}
					kind="tournament"
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
						recordStack({
							stackAmount: values.stackAmount,
							...(values.recordTournamentInfo
								? {
										remainingPlayers: values.remainingPlayers,
										totalEntries: values.totalEntries,
										chipPurchaseCounts: values.chipPurchaseCounts,
									}
								: {}),
						});
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<CompleteSessionForm
					isLoading={isCompletePending}
					kind="tournament"
					onSubmit={(values) => {
						completeTournament(
							values as Parameters<typeof completeTournament>[0]
						);
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

	return activeSession.kind === "cash_game" ? (
		<CashGameStackSheet sessionId={activeSession.id} />
	) : (
		<TournamentStackSheet sessionId={activeSession.id} />
	);
}
