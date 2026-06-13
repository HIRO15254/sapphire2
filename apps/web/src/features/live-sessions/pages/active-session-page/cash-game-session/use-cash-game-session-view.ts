import {
	IconCirclePlus,
	IconCoin,
	IconNote,
	IconSquareRoundedMinus,
} from "@tabler/icons-react";
import { useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";

export interface CashGameCompactSummaryData {
	currentStack: number | null;
	evDiff: number;
	startedAt: Date | string | number;
	totalBuyIn: number;
}

/**
 * View model for the cash-game branch of the active-session page: joins the
 * live session with the scene state, prepares the display-only summary, and
 * owns the type-specific event sheets (all-in / chips / memo / complete)
 * reachable from the "+" event menu and the header session menu.
 */
export function useCashGameSessionView(sessionId: string) {
	const { session, isDiscardPending, discard } = useCashGameSession(sessionId);
	const stack = useCashGameStack({ sessionId });

	const [isAllInOpen, setIsAllInOpen] = useState(false);
	const [isAddChipsOpen, setIsAddChipsOpen] = useState(false);
	const [isRemoveChipsOpen, setIsRemoveChipsOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "cash_game",
		tableSize: session?.tableSize ?? null,
	});

	const summary: CashGameCompactSummaryData | null = session
		? {
				currentStack: session.summary.currentStack,
				evDiff:
					typeof session.summary.evDiff === "number"
						? session.summary.evDiff
						: 0,
				startedAt: session.startedAt ?? new Date(),
				totalBuyIn: session.summary.totalBuyIn,
			}
		: null;

	const eventMenuExtraItems: ActionsDrawerItem[] = [
		{
			icon: IconCoin,
			label: "All-in",
			onSelect: () => setIsAllInOpen(true),
		},
		{
			icon: IconCirclePlus,
			label: "Add chips",
			onSelect: () => setIsAddChipsOpen(true),
		},
		{
			icon: IconSquareRoundedMinus,
			label: "Remove chips",
			onSelect: () => setIsRemoveChipsOpen(true),
		},
		{
			icon: IconNote,
			label: "Memo",
			onSelect: () => setIsMemoOpen(true),
		},
	];

	return {
		defaultFinalStack: summary?.currentStack ?? undefined,
		discard,
		eventMenuExtraItems,
		handleAddChipsSubmit: (values: { amount: number }) => {
			stack.addChip(values.amount);
			setIsAddChipsOpen(false);
		},
		handleAllInSubmit: (values: {
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}) => {
			stack.addAllIn(values);
			setIsAllInOpen(false);
		},
		handleCompleteSubmit: (values: { finalStack: number }) => {
			stack.complete(values);
			setIsCompleteOpen(false);
		},
		handleMemoSubmit: (text: string) => {
			stack.addMemo(text);
			setIsMemoOpen(false);
		},
		handleRemoveChipsSubmit: (values: { amount: number }) => {
			stack.removeChip(values.amount);
			setIsRemoveChipsOpen(false);
		},
		isAddChipsOpen,
		isAllInOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isDiscardPending,
		isMemoOpen,
		isRemoveChipsOpen,
		onEndSession: () => setIsCompleteOpen(true),
		onPause: () => stack.pause(),
		sceneState,
		session: session ?? null,
		setIsAddChipsOpen,
		setIsAllInOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRemoveChipsOpen,
		summary,
	};
}
