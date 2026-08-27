import { IconCards, IconClock, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/hooks/use-active-session-scene-state";
import { useNowTick } from "@/features/live-sessions/hooks/use-now-tick";
import { useSessionEvents } from "@/features/live-sessions/hooks/use-session-events";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import { useTournamentStack } from "@/features/live-sessions/hooks/use-tournament-stack";
import { findLastStackUpdateAt } from "@/features/live-sessions/utils/live-session-view";
import { seatDotColor } from "@/features/live-sessions/utils/seat-dot-color";
import {
	computeTournamentTimerState,
	type TournamentBlindLevel,
} from "@/features/live-sessions/utils/tournament-timer";
import { formatClockElapsed } from "@/utils/format-elapsed-time";
import { formatNumber } from "@/utils/format-number";
import type { PlayerPanelSelection } from "../player-panel";
import type { TableViewPlayerSeat } from "../table-view";

const EVENTS_REFETCH_MS = 30_000;
const LEVEL_TICK_MS = 15_000;

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

function resolveCurrentBigBlind(
	blindLevels: TournamentBlindLevel[],
	timerStartedAt: Date | string | number | null,
	now: number
): number | null {
	if (blindLevels.length === 0 || timerStartedAt === null) {
		return null;
	}
	const state = computeTournamentTimerState(blindLevels, timerStartedAt, now);
	return state.currentLevel?.blind2 ?? null;
}

function computeTournamentCenterModel(
	summary: Record<string, unknown>,
	bigBlind: number | null
) {
	const currentStack =
		typeof summary.currentStack === "number" ? summary.currentStack : null;
	const averageStack =
		typeof summary.averageStack === "number" ? summary.averageStack : null;
	const remainingPlayers =
		typeof summary.remainingPlayers === "number"
			? summary.remainingPlayers
			: null;
	const totalEntries =
		typeof summary.totalEntries === "number" ? summary.totalEntries : null;
	return {
		defaultRemainingPlayers: remainingPlayers,
		defaultTotalEntries: totalEntries,
		tableCenter: {
			averageStackText:
				averageStack === null ? "—" : formatNumber(averageStack),
			bbText:
				currentStack === null || !bigBlind
					? undefined
					: `${formatNumber(Math.round(currentStack / bigBlind))} BB`,
			remainText:
				remainingPlayers === null && totalEntries === null
					? "—"
					: `${remainingPlayers ?? "—"}/${totalEntries ?? "—"}`,
			stackText: currentStack === null ? "—" : formatNumber(currentStack),
		},
	};
}

export function useTournamentSessionView(sessionId: string) {
	const levelTickNow = useNowTick(LEVEL_TICK_MS);
	const tournamentSession = useTournamentSession(sessionId);
	const stack = useTournamentStack({ sessionId });
	const { events } = useSessionEvents({
		sessionId,
		sessionType: "tournament",
		refetchInterval: EVENTS_REFETCH_MS,
	});

	const [selection, setSelection] = useState<PlayerPanelSelection | null>(null);
	const [joinSeatPosition, setJoinSeatPosition] = useState<number | null>(null);
	const [isBuyChipsOpen, setIsBuyChipsOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isTimerDialogOpen, setIsTimerDialogOpen] = useState(false);
	const [isTimelineOpen, setIsTimelineOpen] = useState(false);
	const [isRuleOpen, setIsRuleOpen] = useState(false);
	const [isScanOpen, setIsScanOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);

	const session = tournamentSession.session;
	const isPaused =
		(session as { status?: string } | undefined)?.status === "paused";
	const startedAt =
		(session as { startedAt?: Date | string | number | null } | undefined)
			?.startedAt ?? null;

	const [pausedElapsedText, setPausedElapsedText] = useState("—");
	useEffect(() => {
		if (!isPaused) {
			return;
		}
		setPausedElapsedText(formatClockElapsed(startedAt));
		const id = setInterval(
			() => setPausedElapsedText(formatClockElapsed(startedAt)),
			1000
		);
		return () => clearInterval(id);
	}, [isPaused, startedAt]);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const sceneState = useActiveSessionSceneState({
		heroSeatPosition,
		sessionId,
		sessionType: "tournament",
		tableSize: (session as { tableSize?: number | null })?.tableSize ?? null,
	});

	const currentBigBlind = resolveCurrentBigBlind(
		((session as { blindLevels?: TournamentBlindLevel[] })?.blindLevels ??
			[]) as TournamentBlindLevel[],
		(session as { timerStartedAt?: Date | string | number | null })
			?.timerStartedAt ?? null,
		levelTickNow
	);
	const centerModel = computeTournamentCenterModel(
		((session as { summary?: Record<string, unknown> })?.summary ??
			{}) as Record<string, unknown>,
		currentBigBlind
	);

	const blindLevels = ((session as { blindLevels?: TournamentBlindLevel[] })
		?.blindLevels ?? []) as TournamentBlindLevel[];
	const timerStartedAt =
		(session as { timerStartedAt?: Date | string | number | null })
			?.timerStartedAt ?? null;
	const hasStructure = blindLevels.length > 0;

	const seatedPlayers: TableViewPlayerSeat[] = sceneState.seats.flatMap((s) =>
		s.player
			? [
					{
						dotColor: seatDotColor(s.player.tags),
						playerId: s.player.playerId,
						playerName: s.player.name,
						seatPosition: s.seatPosition,
					},
				]
			: []
	);

	const activeSelection =
		selection &&
		seatedPlayers.some(
			(p) =>
				p.playerId === selection.playerId &&
				p.seatPosition === selection.seatPosition
		)
			? selection
			: null;

	const menuItems: ActionsDrawerItem[] = [
		{
			icon: IconCards,
			label: "Game settings",
			onSelect: () => setIsRuleOpen(true),
		},
		...(hasStructure
			? [
					{
						icon: IconClock,
						label: "Timer settings",
						onSelect: () => setIsTimerDialogOpen(true),
					},
				]
			: []),
		{
			icon: IconTrash,
			label: "Discard session",
			onSelect: () => setIsDiscardOpen(true),
			tone: "destructive" as const,
		},
	];

	return {
		blindLevels,
		chipPurchaseTypes: stack.chipPurchaseTypes,
		defaultRemainingPlayers: centerModel.defaultRemainingPlayers,
		defaultTotalEntries: centerModel.defaultTotalEntries,
		discard: tournamentSession.discard,
		handleBuyChipsSubmit: (values: {
			chips: number;
			cost: number;
			name: string;
			sessionChipPurchaseId: string;
		}) => {
			stack.purchaseChips(values);
			setIsBuyChipsOpen(false);
		},
		handleClearTimer: () => {
			tournamentSession.updateTimerStartedAt(null);
			setIsTimerDialogOpen(false);
		},
		handleCompleteSubmit: (values: TournamentCompleteValues) => {
			stack.complete(values);
			setIsCompleteOpen(false);
		},
		handleMemoSubmit: (text: string) => {
			stack.addMemo(text);
			setIsMemoOpen(false);
		},
		handleRecordStack: (values: {
			remainingPlayers?: number;
			stackAmount: number;
			totalEntries?: number;
		}) => {
			stack.recordStack(values);
		},
		handleSubmitTimer: (value: Date) => {
			tournamentSession.updateTimerStartedAt(value);
			setIsTimerDialogOpen(false);
		},
		hasStructure,
		isBuyChipsOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isDiscardOpen,
		isDiscardPending: tournamentSession.isDiscardPending,
		isMemoOpen,
		isPaused,
		isRuleOpen,
		isScanOpen,
		isStackPending: stack.isStackPending,
		isTimelineOpen,
		isTimerDialogOpen,
		isUpdatingTimer: tournamentSession.isUpdatingTimer,
		joinSeatPosition,
		lastStackUpdatedAt: findLastStackUpdateAt(events),
		menuItems,
		onCloseDiscard: () => setIsDiscardOpen(false),
		onCloseJoin: () => setJoinSeatPosition(null),
		onEmptySeatTap: (seatPosition: number) => {
			if (!isPaused) {
				setJoinSeatPosition(seatPosition);
			}
		},
		onEndSession: () => setIsCompleteOpen(true),
		onLeavePlayer: (sel: PlayerPanelSelection) => {
			sceneState.onRemovePlayer(sel.playerId);
			setSelection(null);
		},
		onOpenBuyChips: () => {
			if (!isPaused) {
				setIsBuyChipsOpen(true);
			}
		},
		onOpenMemo: () => setIsMemoOpen(true),
		onOpenRule: () => setIsRuleOpen(true),
		onOpenTimeline: () => setIsTimelineOpen(true),
		onOpenTimerDialog: () => setIsTimerDialogOpen(true),
		onPlayerSeatTap: (seat: TableViewPlayerSeat) => {
			if (!isPaused) {
				setSelection(seat);
			}
		},
		onResume: () => stack.resume(),
		onScanFromJoin: () => {
			setJoinSeatPosition(null);
			setIsScanOpen(true);
		},
		onScanFromTable: () => {
			if (!isPaused) {
				setIsScanOpen(true);
			}
		},
		onTogglePause: () => {
			if (isPaused) {
				stack.resume();
			} else {
				stack.pause();
			}
		},
		pausedElapsedText,
		sceneState,
		seatedPlayers,
		selection: activeSelection,
		session: session ?? null,
		title: (session as { ruleName?: string | null })?.ruleName ?? "Tournament",
		setIsBuyChipsOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRuleOpen,
		setIsScanOpen,
		setIsTimelineOpen,
		setIsTimerDialogOpen,
		startedAt,
		tableCenter: centerModel.tableCenter,
		timerStartedAt,
	};
}
