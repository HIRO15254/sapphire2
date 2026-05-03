import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
	useStackFormContext,
	useTournamentFormContext,
} from "@/features/live-sessions/hooks/use-session-form";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";
import { trpc } from "@/utils/trpc";

interface StackEventPayload {
	buyInAmount?: number;
	remainingPlayers?: number | null;
	stackAmount?: number;
	totalEntries?: number | null;
}

function getLastStackPayload(
	events: { eventType: string; payload?: unknown }[]
): StackEventPayload | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (
			event &&
			(event.eventType === "update_stack" ||
				event.eventType === "session_start")
		) {
			return event.payload as StackEventPayload;
		}
	}
	return null;
}

export function useCashGameStackSheet({ sessionId }: { sessionId: string }) {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	const { setStackAmount } = useStackFormContext();
	const eventsQuery = useQuery(
		trpc.sessionEvent.list.queryOptions({ liveCashGameSessionId: sessionId })
	);
	const events = eventsQuery.data ?? [];

	const prevIsOpenRef = useRef(stackSheet.isOpen);
	useEffect(() => {
		const justOpened = stackSheet.isOpen && !prevIsOpenRef.current;
		prevIsOpenRef.current = stackSheet.isOpen;
		if (!justOpened) {
			return;
		}

		const payload = getLastStackPayload(events);
		if (!payload) {
			return;
		}

		// update_stack → stackAmount; session_start → buyInAmount as initial stack
		const amount =
			payload.stackAmount === undefined
				? payload.buyInAmount
				: payload.stackAmount;
		if (amount !== undefined) {
			setStackAmount(String(amount));
		}
	}, [stackSheet.isOpen, events, setStackAmount]);

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
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const { setStackAmount, setRemainingPlayers, setTotalEntries } =
		useTournamentFormContext();
	const eventsQuery = useQuery(
		trpc.sessionEvent.list.queryOptions({
			liveTournamentSessionId: sessionId,
		})
	);
	const events = eventsQuery.data ?? [];

	const prevIsOpenRef = useRef(stackSheet.isOpen);
	useEffect(() => {
		const justOpened = stackSheet.isOpen && !prevIsOpenRef.current;
		prevIsOpenRef.current = stackSheet.isOpen;
		if (!justOpened) {
			return;
		}

		const payload = getLastStackPayload(events);
		if (!payload) {
			return;
		}

		if (payload.stackAmount !== undefined) {
			setStackAmount(String(payload.stackAmount));
		}
		if (payload.remainingPlayers !== undefined) {
			setRemainingPlayers(
				payload.remainingPlayers === null
					? ""
					: String(payload.remainingPlayers)
			);
		}
		if (payload.totalEntries !== undefined) {
			setTotalEntries(
				payload.totalEntries === null ? "" : String(payload.totalEntries)
			);
		}
	}, [
		stackSheet.isOpen,
		events,
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
