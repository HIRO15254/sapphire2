import {
	IconCards,
	IconCirclePlus,
	IconSquareRoundedMinus,
	IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ActionsDrawerItem } from "@/features/live-sessions/components/actions-drawer";
import { useActiveSessionSceneState } from "@/features/live-sessions/hooks/use-active-session-scene-state";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";
import {
	type SessionEvent,
	useSessionEvents,
} from "@/features/live-sessions/hooks/use-session-events";
import { formatClockElapsed } from "@/utils/format-elapsed-time";
import { formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import type { PlayerPanelSelection } from "../player-panel";
import type { TableViewPlayerSeat } from "../table-view";

const EVENTS_REFETCH_MS = 30_000;

export function findLastStackUpdateAt(
	events: SessionEvent[]
): SessionEvent["occurredAt"] | null {
	for (let i = events.length - 1; i >= 0; i--) {
		const event = events[i];
		if (event?.eventType === "update_stack") {
			return event.occurredAt;
		}
	}
	return null;
}

export function deltaToneOf(
	value: number | null
): "positive" | "negative" | "neutral" {
	if (value === null || value === 0) {
		return "neutral";
	}
	return value > 0 ? "positive" : "negative";
}

export function useCashGameSessionView(sessionId: string) {
	const { session, isDiscardPending, discard } = useCashGameSession(sessionId);
	const stack = useCashGameStack({ sessionId });
	const { events } = useSessionEvents({
		sessionId,
		sessionType: "cash_game",
		refetchInterval: EVENTS_REFETCH_MS,
	});

	const [selection, setSelection] = useState<PlayerPanelSelection | null>(null);
	const [joinSeatPosition, setJoinSeatPosition] = useState<number | null>(null);
	const [isAllInOpen, setIsAllInOpen] = useState(false);
	const [isAddChipsOpen, setIsAddChipsOpen] = useState(false);
	const [isRemoveChipsOpen, setIsRemoveChipsOpen] = useState(false);
	const [isChipMenuOpen, setIsChipMenuOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isTimelineOpen, setIsTimelineOpen] = useState(false);
	const [isRuleOpen, setIsRuleOpen] = useState(false);
	const [isScanOpen, setIsScanOpen] = useState(false);
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);

	const isPaused = session?.status === "paused";
	const startedAt = session?.startedAt ?? null;

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
		sessionType: "cash_game",
		tableSize: session?.tableSize ?? null,
	});

	const chipRemoveTotal =
		typeof session?.summary.chipRemoveTotal === "number"
			? session.summary.chipRemoveTotal
			: 0;
	const evDiff =
		typeof session?.summary.evDiff === "number" ? session.summary.evDiff : 0;
	const totalBuyIn = session?.summary.totalBuyIn ?? 0;
	const currentStack = session?.summary.currentStack ?? null;

	const displayPL =
		currentStack === null ? null : currentStack + chipRemoveTotal - totalBuyIn;
	const evPL =
		currentStack !== null && evDiff !== 0
			? currentStack + chipRemoveTotal + evDiff - totalBuyIn
			: null;
	const showEvPL = evPL !== null && evPL !== displayPL;

	const seatedPlayers: TableViewPlayerSeat[] = sceneState.seats.flatMap((s) =>
		s.player
			? [
					{
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
		{
			icon: IconTrash,
			label: "Discard session",
			onSelect: () => setIsDiscardOpen(true),
			tone: "destructive" as const,
		},
	];

	const chipMenuItems: ActionsDrawerItem[] = [
		{
			icon: IconCirclePlus,
			label: "Add chips",
			onSelect: () => {
				setIsChipMenuOpen(false);
				setIsAddChipsOpen(true);
			},
		},
		{
			icon: IconSquareRoundedMinus,
			label: "Remove chips",
			onSelect: () => {
				setIsChipMenuOpen(false);
				setIsRemoveChipsOpen(true);
			},
		},
	];

	return {
		chipMenuItems,
		discard,
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
		handleRecordStack: (values: { stackAmount: number }) => {
			stack.recordStack(values);
		},
		handleRemoveChipsSubmit: (values: { amount: number }) => {
			stack.removeChip(values.amount);
			setIsRemoveChipsOpen(false);
		},
		completePreviewInput: {
			chipRemoveTotal,
			evDiff: evDiff === 0 ? null : evDiff,
			totalBuyIn,
		},
		defaultFinalStack: currentStack ?? undefined,
		isAddChipsOpen,
		isAllInOpen,
		isChipMenuOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isDiscardOpen,
		isDiscardPending,
		isMemoOpen,
		isPaused,
		isRemoveChipsOpen,
		isRuleOpen,
		isScanOpen,
		isStackPending: stack.isStackPending,
		isTimelineOpen,
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
		onOpenAllIn: () => {
			if (!isPaused) {
				setIsAllInOpen(true);
			}
		},
		onOpenChipMenu: () => {
			if (!isPaused) {
				setIsChipMenuOpen(true);
			}
		},
		onOpenMemo: () => setIsMemoOpen(true),
		onOpenRule: () => setIsRuleOpen(true),
		onOpenTimeline: () => setIsTimelineOpen(true),
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
		setIsAddChipsOpen,
		setIsAllInOpen,
		setIsChipMenuOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRemoveChipsOpen,
		setIsRuleOpen,
		setIsScanOpen,
		setIsTimelineOpen,
		startedAt,
		tableCenter: {
			deltaText: displayPL === null ? undefined : formatProfitLoss(displayPL),
			deltaTone: deltaToneOf(displayPL),
			evText: showEvPL && evPL !== null ? formatProfitLoss(evPL) : undefined,
			stackText: currentStack === null ? "—" : formatNumber(currentStack),
		},
	};
}
