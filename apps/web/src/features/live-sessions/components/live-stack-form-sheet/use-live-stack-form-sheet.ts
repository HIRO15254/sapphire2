import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	useStackFormContext,
	useTournamentFormContext,
} from "@/features/live-sessions/hooks/use-session-form";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";
import { trpc } from "@/utils/trpc";

export function useCashGameStackSheet(sessionId: string) {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const { setStackAmount } = useStackFormContext();

	const sessionQuery = useQuery({
		...trpc.liveCashGameSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const summary = sessionQuery.data?.summary as
		| Record<string, unknown>
		| undefined;

	const prevIsOpen = useRef(false);
	useEffect(() => {
		const justOpened = stackSheet.isOpen && !prevIsOpen.current;
		prevIsOpen.current = stackSheet.isOpen;
		if (!justOpened) {
			return;
		}
		const currentStack = summary?.currentStack;
		const totalBuyIn = summary?.totalBuyIn;
		if (typeof currentStack === "number") {
			setStackAmount(String(currentStack));
		} else if (typeof totalBuyIn === "number") {
			setStackAmount(String(totalBuyIn));
		}
	}, [stackSheet.isOpen, summary, setStackAmount]);

	return {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
		defaultFinalStack,
		setDefaultFinalStack,
	};
}

export function useTournamentStackSheet(sessionId: string) {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const { setStackAmount, setRemainingPlayers, setTotalEntries } =
		useTournamentFormContext();

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const summary = sessionQuery.data?.summary as
		| Record<string, unknown>
		| undefined;

	const prevIsOpen = useRef(false);
	useEffect(() => {
		const justOpened = stackSheet.isOpen && !prevIsOpen.current;
		prevIsOpen.current = stackSheet.isOpen;
		if (!justOpened) {
			return;
		}
		if (typeof summary?.currentStack === "number") {
			setStackAmount(String(summary.currentStack));
		}
		if (typeof summary?.remainingPlayers === "number") {
			setRemainingPlayers(String(summary.remainingPlayers));
		}
		if (typeof summary?.totalEntries === "number") {
			setTotalEntries(String(summary.totalEntries));
		}
	}, [
		stackSheet.isOpen,
		summary,
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
