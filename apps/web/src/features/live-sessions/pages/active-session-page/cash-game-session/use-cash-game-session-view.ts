import {
	IconCirclePlus,
	IconCoin,
	IconNote,
	IconSquareRoundedMinus,
	IconTransferIn,
	IconTransferOut,
} from "@tabler/icons-react";
import { useState } from "react";
import { useItems } from "@/features/items/hooks/use-items";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";
import {
	filterVirtualItemsForCurrency,
	type VirtualAmountItemOption,
	type VirtualAmountPayload,
} from "@/features/live-sessions/utils/virtual-amount";

export interface CashGameCompactSummaryData {
	chipRemoveTotal: number;
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
	const [isVirtualBuyInOpen, setIsVirtualBuyInOpen] = useState(false);
	const [isVirtualCashOutOpen, setIsVirtualCashOutOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	// Only items denominated in the session's currency can be recorded (the
	// stats aggregation ignores mismatched-currency usages, fail closed).
	const { items } = useItems();
	const sessionCurrencyId =
		typeof session?.currencyId === "string" ? session.currencyId : null;
	const virtualItems: VirtualAmountItemOption[] = filterVirtualItemsForCurrency(
		items.map((item) => ({
			id: item.id,
			name: item.name,
			unitValue: item.unitValue,
			currencyId: item.currencyId,
		})),
		sessionCurrencyId
	);

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
				chipRemoveTotal:
					typeof session.summary.chipRemoveTotal === "number"
						? session.summary.chipRemoveTotal
						: 0,
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
			icon: IconTransferIn,
			label: "Virtual buy-in",
			onSelect: () => setIsVirtualBuyInOpen(true),
		},
		{
			icon: IconTransferOut,
			label: "Virtual cash-out",
			onSelect: () => setIsVirtualCashOutOpen(true),
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
		handleVirtualBuyInSubmit: (payload: VirtualAmountPayload) => {
			stack.addVirtualBuyIn(payload);
			setIsVirtualBuyInOpen(false);
		},
		handleVirtualCashOutSubmit: (payload: VirtualAmountPayload) => {
			stack.addVirtualCashOut(payload);
			setIsVirtualCashOutOpen(false);
		},
		isAddChipsOpen,
		isAllInOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isDiscardPending,
		isMemoOpen,
		isRemoveChipsOpen,
		isVirtualBuyInOpen,
		isVirtualCashOutOpen,
		onEndSession: () => setIsCompleteOpen(true),
		onPause: () => stack.pause(),
		sceneState,
		session: session ?? null,
		setIsAddChipsOpen,
		setIsAllInOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRemoveChipsOpen,
		setIsVirtualBuyInOpen,
		setIsVirtualCashOutOpen,
		summary,
		virtualItems,
	};
}
