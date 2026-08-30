import { useEffect, useState } from "react";
import { useActiveSessionSceneState } from "@/features/live-sessions/hooks/use-active-session-scene-state";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";
import { useSessionEvents } from "@/features/live-sessions/hooks/use-session-events";
import {
	deltaToneOf,
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/live-session-view";
import { seatDotColor } from "@/features/live-sessions/utils/seat-dot-color";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";
import { formatClockElapsed } from "@/utils/format-elapsed-time";
import { formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import type { PlayerPanelSelection } from "../player-panel";
import type { TableViewPlayerSeat } from "../table-view";

const EVENTS_REFETCH_MS = 30_000;

function computeCashCenterModel(
	summary:
		| {
				chipRemoveTotal?: unknown;
				currentStack: number | null;
				evDiff?: unknown;
				totalBuyIn: number;
		  }
		| undefined,
	bigBlind: number | null
) {
	const chipRemoveTotal =
		typeof summary?.chipRemoveTotal === "number" ? summary.chipRemoveTotal : 0;
	const evDiff = typeof summary?.evDiff === "number" ? summary.evDiff : 0;
	const totalBuyIn = summary?.totalBuyIn ?? 0;
	const currentStack = summary?.currentStack ?? null;
	const displayPL =
		currentStack === null ? null : currentStack + chipRemoveTotal - totalBuyIn;
	const evPL =
		currentStack !== null && evDiff !== 0
			? currentStack + chipRemoveTotal + evDiff - totalBuyIn
			: null;
	const showEvPL = evPL !== null && evPL !== displayPL;
	return {
		completePreviewInput: {
			chipRemoveTotal,
			evDiff: evDiff === 0 ? null : evDiff,
			totalBuyIn,
		},
		defaultFinalStack: currentStack ?? undefined,
		tableCenter: {
			bbText:
				currentStack === null || !bigBlind
					? undefined
					: `${formatNumber(Math.round(currentStack / bigBlind))} BB`,
			deltaText:
				displayPL === null
					? undefined
					: formatProfitLoss(displayPL, { compact: false }),
			deltaTone: deltaToneOf(displayPL),
			evText:
				showEvPL && evPL !== null
					? formatProfitLoss(evPL, { compact: false })
					: undefined,
			stackText: currentStack === null ? "—" : formatNumber(currentStack),
		},
	};
}

export function useCashGameSessionView(sessionId: string) {
	const isKeyboardOpen = useKeyboardOpen();
	const { session } = useCashGameSession(sessionId);
	const stack = useCashGameStack({ sessionId });
	const { events } = useSessionEvents({
		sessionId,
		sessionType: "cash_game",
		refetchInterval: EVENTS_REFETCH_MS,
	});

	const [selection, setSelection] = useState<PlayerPanelSelection | null>(null);
	const [joinSeatPosition, setJoinSeatPosition] = useState<number | null>(null);
	const [isAllInOpen, setIsAllInOpen] = useState(false);
	const [isChipsOpen, setIsChipsOpen] = useState(false);
	const [isMemoOpen, setIsMemoOpen] = useState(false);
	const [isCompleteOpen, setIsCompleteOpen] = useState(false);
	const [isTimelineOpen, setIsTimelineOpen] = useState(false);
	const [isRuleOpen, setIsRuleOpen] = useState(false);
	const [isScanOpen, setIsScanOpen] = useState(false);

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

	const centerModel = computeCashCenterModel(
		session?.summary,
		session?.blind2 ?? null
	);

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

	return {
		handleChipsSubmit: (values: { amount: number }) => {
			stack.adjustChips(values.amount);
			setIsChipsOpen(false);
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
		completePreviewInput: centerModel.completePreviewInput,
		defaultFinalStack: centerModel.defaultFinalStack,
		isChipsOpen,
		isAllInOpen,
		isCompleteOpen,
		isCompletePending: stack.isCompletePending,
		isMemoOpen,
		isKeyboardOpen,
		isPaused,
		isRuleOpen,
		isScanOpen,
		isStackPending: stack.isStackPending,
		isTimelineOpen,
		joinSeatPosition,
		lastStackUpdatedAt: findLastStackUpdateAt(events),
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
		onOpenChips: () => {
			if (!isPaused) {
				setIsChipsOpen(true);
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
		title: session?.ruleName ?? "Cash Game",
		setIsChipsOpen,
		setIsAllInOpen,
		setIsCompleteOpen,
		setIsMemoOpen,
		setIsRuleOpen,
		setIsScanOpen,
		setIsTimelineOpen,
		startedAt,
		tableCenter: centerModel.tableCenter,
	};
}
