import { useStackRecord } from "@/features/live-sessions/hooks/use-stack-record";

export function useCashGameStack({ sessionId }: { sessionId: string }) {
	const {
		recordStack,
		addChip,
		removeChip,
		addAllIn,
		addMemo,
		pause,
		resume,
		completeCash,
		isStackPending,
		isCompletePending,
	} = useStackRecord({ sessionId, kind: "cash_game" });

	return {
		recordStack: (values: { stackAmount: number }) => recordStack(values),
		addChip,
		removeChip,
		addAllIn,
		addMemo,
		pause,
		resume,
		complete: (values: { finalStack: number }) => completeCash(values),
		isStackPending,
		isCompletePending,
	};
}
