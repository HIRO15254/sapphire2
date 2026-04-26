import { useState } from "react";
import { useStackSheet } from "@/features/live-sessions/hooks/use-stack-sheet";

export function useCashGameStackSheet() {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [defaultFinalStack, setDefaultFinalStack] = useState<
		number | undefined
	>(undefined);

	return {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
		defaultFinalStack,
		setDefaultFinalStack,
	};
}

export function useTournamentStackSheet() {
	const stackSheet = useStackSheet();
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	return {
		stackSheet,
		isCompleteOpen,
		setIsCompleteOpen,
	};
}
