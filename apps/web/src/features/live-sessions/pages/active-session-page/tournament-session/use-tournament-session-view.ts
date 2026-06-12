import { IconCoins, IconNote } from "@tabler/icons-react";
import { useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import { useTournamentStack } from "@/features/live-sessions/hooks/use-tournament-stack";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";

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
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);

	const session = tournamentSession.session;
	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "tournament",
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
		hasStructure,
		isBuyChipsOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isMemoOpen,
		isTimerDialogOpen,
		onEndSession: () => setIsCompleteOpen(true),
		onPause: () => stack.pause(),
		sceneState,
		setIsBuyChipsOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsTimerDialogOpen,
		timerStartedAt,
		tournamentSummary,
	};
}
