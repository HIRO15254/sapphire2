import { useStackRecord } from "@/features/live-sessions/hooks/use-stack-record";

type CompleteTournamentValues =
	| {
			beforeDeadline: false;
			bountyPrizes: number;
			placement: number;
			prizeMoney: number;
			totalEntries: number;
	  }
	| {
			beforeDeadline: true;
			bountyPrizes: number;
			prizeMoney: number;
	  };

export function useTournamentStack({ sessionId }: { sessionId: string }) {
	const {
		chipPurchaseOptions,
		recordStack,
		purchaseChips,
		addMemo,
		pause,
		resume,
		completeTournament,
		isStackPending,
		isCompletePending,
	} = useStackRecord({ sessionId, kind: "tournament" });

	return {
		chipPurchaseTypes: chipPurchaseOptions.map((o) => ({
			id: o.id,
			name: o.name,
			cost: o.cost,
			chips: o.chips,
		})),
		recordStack,
		purchaseChips,
		addMemo,
		pause,
		resume,
		complete: (values: CompleteTournamentValues) => completeTournament(values),
		isStackPending,
		isCompletePending,
	};
}
