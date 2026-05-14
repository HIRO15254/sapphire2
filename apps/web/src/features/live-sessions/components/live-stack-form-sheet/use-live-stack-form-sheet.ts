import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	useStackFormContext,
	useTournamentFormContext,
} from "@/features/live-sessions/hooks/use-session-form";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";
import { trpc } from "@/utils/trpc";

export function useCashGameStackSheet({ sessionId }: { sessionId: string }) {
	const stackSheet = useStackSheet();
	const { setStackAmount } = useStackFormContext();
	const { data: sessionData } = useQuery(
		trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
	);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const prevOpen = useRef(false);
	useEffect(() => {
		if (stackSheet.isOpen && !prevOpen.current) {
			const summary = sessionData?.summary;
			if (summary) {
				const amount = summary.currentStack ?? summary.totalBuyIn;
				if (amount != null) {
					setStackAmount(String(amount));
				}
			}
		}
		prevOpen.current = stackSheet.isOpen;
	}, [stackSheet.isOpen, sessionData, setStackAmount]);

	return {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
		defaultFinalStack,
		setDefaultFinalStack,
	};
}

export function useTournamentStackSheet({ sessionId }: { sessionId: string }) {
	const stackSheet = useStackSheet();
	const { setStackAmount, setRemainingPlayers, setTotalEntries } =
		useTournamentFormContext();
	const { data: sessionData } = useQuery(
		trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
	);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const prevOpen = useRef(false);
	useEffect(() => {
		if (stackSheet.isOpen && !prevOpen.current) {
			const summary = sessionData?.summary;
			if (summary) {
				if (summary.currentStack != null) {
					setStackAmount(String(summary.currentStack));
				}
				if (summary.remainingPlayers != null) {
					setRemainingPlayers(String(summary.remainingPlayers));
				}
				if (summary.totalEntries != null) {
					setTotalEntries(String(summary.totalEntries));
				}
			}
		}
		prevOpen.current = stackSheet.isOpen;
	}, [
		stackSheet.isOpen,
		sessionData,
		setStackAmount,
		setRemainingPlayers,
		setTotalEntries,
	]);

	return {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
	};
}
