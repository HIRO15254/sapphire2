import { isEventAllowedInState } from "@sapphire2/db/constants/session-event-types";
import { useState } from "react";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";
import { useSessionSeats } from "@/features/live-sessions/hooks/use-session-seats";
import {
	computeBigBlinds,
	computeCashGamePL,
} from "@/features/live-sessions/utils/live-session-summary";
import { computeSessionClock } from "@/features/live-sessions/utils/session-clock";
import {
	describeStaleness,
	findStackReference,
} from "@/features/live-sessions/utils/session-staleness";
import { formatTimerDuration } from "@/features/live-sessions/utils/tournament-timer";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";
import { useNowTick } from "@/shared/hooks/use-now-tick";
import { formatLocalHm, formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { resolveRuleName, toSessionStatus } from "../session-fields";
import type { ChipPurchaseOption } from "../sheets";
import { useSeatSelection } from "../use-seat-selection";
import { useSessionJournal } from "../use-session-journal";

const TICK_MS = 1000;
const NO_PURCHASE_OPTIONS: ChipPurchaseOption[] = [];

export function useCashCockpit(sessionId: string) {
	const { session } = useCashGameSession(sessionId);
	const stack = useCashGameStack({ sessionId });
	const now = useNowTick(TICK_MS);
	const isKeyboardOpen = useKeyboardOpen();
	const [isEndSessionOpen, setIsEndSessionOpen] = useState(false);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const seatState = useSessionSeats({
		heroSeatPosition,
		sessionId,
		sessionType: "cash_game",
		tableSize: session?.tableSize ?? null,
	});
	const { playerNames, seats } = seatState;
	const seatSelection = useSeatSelection(seats);
	const status = toSessionStatus(session?.status ?? "");
	const journal = useSessionJournal({
		chipPurchaseOptions: NO_PURCHASE_OPTIONS,
		onMoveSeat: seatState.onMoveSeat,
		playerNames,
		seatCount: seats.length,
		sessionId,
		sessionType: "cash_game",
		status,
	});

	if (!session || journal.isEventsLoading) {
		return { isLoading: true as const };
	}

	const summary = session.summary;
	const currentStack = summary.currentStack;
	const chipRemoveTotal = summary.chipRemoveTotal ?? 0;
	const evDiff = summary.evDiff ?? 0;
	const totalBuyIn = summary.totalBuyIn;

	const { displayPL, evPL, showEvPL } = computeCashGamePL({
		chipRemoveTotal,
		currentStack,
		evDiff,
		totalBuyIn,
	});

	const sitIn = (apply: (seatPosition: number) => void) => {
		const seatPosition = seatSelection.sitInSeatPosition;
		if (seatPosition === null) {
			return;
		}
		apply(seatPosition);
		seatSelection.onCloseSeatSheet();
	};

	const clock = computeSessionClock(journal.events, now);

	const stackReference = findStackReference(journal.events);
	const bigBlinds = computeBigBlinds(currentStack, session.blind2);

	return {
		bbText: bigBlinds === null ? "— BB" : `${formatNumber(bigBlinds)} BB`,
		chipRemoveTotal,
		defaultFinalStack: currentStack ?? undefined,
		displayPL,
		displayPLFormatted: displayPL === null ? "—" : formatProfitLoss(displayPL),
		elapsed: formatTimerDuration(clock.activeSeconds, { padHours: true }),
		evDiff,
		evPLFormatted: showEvPL && evPL !== null ? formatProfitLoss(evPL) : null,
		isCompletePending: stack.isCompletePending,
		isEndSessionOpen,
		isKeyboardOpen,
		isLoading: false as const,
		isMasterLinked: Boolean(session.ringGameId),
		journal,
		pausedElapsed: formatTimerDuration(clock.pausedSeconds, {
			padHours: true,
		}),
		isPaused: status === "paused",
		isStackPending: stack.isStackPending,
		canRecordStack: isEventAllowedInState("update_stack", status),
		referenceLabel:
			stackReference === null ? null : formatLocalHm(stackReference.at),
		onEndSession: () => setIsEndSessionOpen(true),
		onEndSessionOpenChange: setIsEndSessionOpen,
		onCompleteSubmit: (values: { finalStack: number }) =>
			stack.complete(values),
		onPause: () => stack.pause(),
		onRecordStack: (values: { stackAmount: number }) =>
			stack.recordStack(values),
		onResume: () => stack.resume(),
		ruleName: resolveRuleName(session.ruleName, session.variant, "Cash game"),
		excludePlayerIds: seatState.excludePlayerIds,
		heroSeatPosition,
		onCloseSeatSheet: seatSelection.onCloseSeatSheet,
		onLeaveSeat: seatState.onRemovePlayer,
		onOpenScan: seatSelection.onOpenScan,
		onSelectSeat: seatSelection.onSelectSeat,
		onSitInExisting: (playerId: string, playerName: string) => {
			sitIn((seatPosition) =>
				seatState.onSeatExisting(seatPosition, playerId, playerName)
			);
		},
		onSitInHero: () => {
			sitIn((seatPosition) => seatState.onSeatHero(seatPosition));
		},
		onSitInNew: (name: string) => {
			sitIn((seatPosition) => seatState.onSeatNew(seatPosition, { name }));
		},
		scanSeats: seatSelection.scanSeats,
		seatSheet: seatSelection.seatSheet,
		seats,
		selectedPlayerId: seatSelection.selectedPlayerId,
		selectedSeatPosition: seatSelection.selectedSeatPosition,
		sessionParam: seatState.sessionParam,
		sitInSeatPosition: seatSelection.sitInSeatPosition,
		stackFormatted: currentStack === null ? "—" : formatNumber(currentStack),
		staleness: describeStaleness(stackReference?.at ?? null, now),
		stalenessSource: stackReference?.source ?? null,
		totalBuyIn,
	};
}
