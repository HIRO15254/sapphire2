import { useState } from "react";
import { CashGameCompleteForm } from "@/components/live-cash-game/cash-game-complete-form";
import { CashGameStackForm } from "@/components/live-cash-game/cash-game-stack-form";
import { TournamentCompleteForm } from "@/components/live-tournament/tournament-complete-form";
import { TournamentStackForm } from "@/components/live-tournament/tournament-stack-form";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useActiveSession } from "@/hooks/use-active-session";
import { useCashGameStack } from "@/hooks/use-cash-game-stack";
import { useStackSheet } from "@/hooks/use-stack-sheet";
import { useTournamentStack } from "@/hooks/use-tournament-stack";

function CashGameStackSheet({ sessionId }: { sessionId: string }) {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const { recordStack, addChip, complete, isStackPending, isCompletePending } =
		useCashGameStack({ sessionId });

	return (
		<>
			<ResponsiveDialog
				description="Record the latest stack and any related all-ins or addons for this cash game."
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<CashGameStackForm
					isLoading={isStackPending}
					onChipAdd={(amount) => addChip(amount)}
					onComplete={(currentStack) => {
						stackSheet.close();
						setDefaultFinalStack(currentStack);
						setIsCompleteOpen(true);
					}}
					onSubmit={(values) => {
						recordStack(values);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				description="Enter the final stack to complete this cash game session."
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Session"
			>
				<CashGameCompleteForm
					defaultFinalStack={defaultFinalStack}
					isLoading={isCompletePending}
					onSubmit={(values) => complete(values)}
				/>
			</ResponsiveDialog>
		</>
	);
}

function TournamentStackSheet({ sessionId }: { sessionId: string }) {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const {
		chipPurchaseTypes,
		recordStack,
		complete,
		isStackPending,
		isCompletePending,
	} = useTournamentStack({ sessionId });

	return (
		<>
			<ResponsiveDialog
				description="Record the latest stack, remaining players, and chip purchases for this tournament."
				onOpenChange={stackSheet.setIsOpen}
				open={stackSheet.isOpen}
				title="Record Stack"
			>
				<TournamentStackForm
					chipPurchaseTypes={chipPurchaseTypes}
					isLoading={isStackPending}
					onComplete={() => {
						stackSheet.close();
						setIsCompleteOpen(true);
					}}
					onSubmit={(values) => {
						recordStack(values);
						stackSheet.close();
					}}
				/>
			</ResponsiveDialog>

			<ResponsiveDialog
				description="Enter the tournament result to complete this live session."
				onOpenChange={setIsCompleteOpen}
				open={isCompleteOpen}
				title="Complete Tournament"
			>
				<TournamentCompleteForm
					isLoading={isCompletePending}
					onSubmit={(values) => complete(values)}
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
