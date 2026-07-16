import {
	IconCoins,
	IconNote,
	IconTransferIn,
	IconTransferOut,
} from "@tabler/icons-react";
import { useState } from "react";
import { useItems } from "@/features/items/hooks/use-items";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import { useTournamentStack } from "@/features/live-sessions/hooks/use-tournament-stack";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import {
	filterVirtualItemsForCurrency,
	type VirtualAmountItemOption,
	type VirtualAmountPayload,
} from "@/features/live-sessions/utils/virtual-amount";

export interface TournamentSummaryData {
	averageStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

type TournamentCompleteValues =
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

function buildTournamentSummary(
	summary: Record<string, unknown>
): TournamentSummaryData {
	return {
		averageStack:
			typeof summary.averageStack === "number" ? summary.averageStack : null,
		remainingPlayers:
			typeof summary.remainingPlayers === "number"
				? summary.remainingPlayers
				: null,
		totalEntries:
			typeof summary.totalEntries === "number" ? summary.totalEntries : null,
	};
}

/**
 * View model for the tournament branch of the active-session page: timer
 * dialog state over useTournamentSession, summary / blind-structure
 * derivations, and the type-specific event sheets (chip purchase / memo /
 * complete) reachable from the "+" event menu and the header session menu.
 */
export function useTournamentSessionView(sessionId: string) {
	const tournamentSession = useTournamentSession(sessionId);
	const stack = useTournamentStack({ sessionId });
	const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);
	const [isBuyChipsOpen, setIsBuyChipsOpen] = useState(false);
	const [isVirtualBuyInOpen, setIsVirtualBuyInOpen] = useState(false);
	const [isVirtualCashOutOpen, setIsVirtualCashOutOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const session = tournamentSession.session;

	// Only items denominated in the session's currency can be recorded (the
	// stats aggregation ignores mismatched-currency usages, fail closed).
	const { items } = useItems();
	const rawCurrencyId = (session as { currencyId?: string | null } | null)
		?.currencyId;
	const sessionCurrencyId =
		typeof rawCurrencyId === "string" ? rawCurrencyId : null;
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
		sessionType: "tournament",
		tableSize: (session as { tableSize?: number | null })?.tableSize ?? null,
	});

	const tournamentSummary: TournamentSummaryData | null = session
		? buildTournamentSummary(
				((session as { summary?: Record<string, unknown> }).summary ??
					{}) as Record<string, unknown>
			)
		: null;

	const blindLevels = ((session as { blindLevels?: TournamentBlindLevel[] })
		?.blindLevels ?? []) as TournamentBlindLevel[];
	const timerStartedAt =
		(session as { timerStartedAt?: Date | string | number | null })
			?.timerStartedAt ?? null;
	const hasStructure = blindLevels.length > 0;

	const handleOpenTimerDialog = () => {
		setIsTimerDialogOpen(true);
	};

	const handleClearTimer = () => {
		tournamentSession.updateTimerStartedAt(null);
		setIsTimerDialogOpen(false);
	};

	const handleSubmitTimer = (value: Date) => {
		tournamentSession.updateTimerStartedAt(value);
		setIsTimerDialogOpen(false);
	};

	const eventMenuExtraItems: ActionsDrawerItem[] = [
		{
			icon: IconCoins,
			label: "Buy chips",
			onSelect: () => setIsBuyChipsOpen(true),
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
		...tournamentSession,
		blindLevels,
		chipPurchaseTypes: stack.chipPurchaseTypes,
		eventMenuExtraItems,
		handleBuyChipsSubmit: (values: {
			chips: number;
			cost: number;
			name: string;
			sessionChipPurchaseId: string;
		}) => {
			stack.purchaseChips(values);
			setIsBuyChipsOpen(false);
		},
		handleClearTimer,
		handleCompleteSubmit: (values: TournamentCompleteValues) => {
			stack.complete(values);
			setIsCompleteOpen(false);
		},
		handleMemoSubmit: (text: string) => {
			stack.addMemo(text);
			setIsMemoOpen(false);
		},
		handleOpenTimerDialog,
		handleSubmitTimer,
		handleVirtualBuyInSubmit: (payload: VirtualAmountPayload) => {
			stack.addVirtualBuyIn(payload);
			setIsVirtualBuyInOpen(false);
		},
		handleVirtualCashOutSubmit: (payload: VirtualAmountPayload) => {
			stack.addVirtualCashOut(payload);
			setIsVirtualCashOutOpen(false);
		},
		hasStructure,
		isBuyChipsOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isMemoOpen,
		isTimerDialogOpen,
		isVirtualBuyInOpen,
		isVirtualCashOutOpen,
		onEndSession: () => setIsCompleteOpen(true),
		onPause: () => stack.pause(),
		sceneState,
		setIsBuyChipsOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsTimerDialogOpen,
		setIsVirtualBuyInOpen,
		setIsVirtualCashOutOpen,
		timerStartedAt,
		tournamentSummary,
		virtualItems,
	};
}
