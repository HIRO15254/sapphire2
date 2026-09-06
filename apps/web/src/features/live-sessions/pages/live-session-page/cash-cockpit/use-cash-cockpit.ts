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
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/session-staleness";
import { formatTimerDuration } from "@/features/live-sessions/utils/tournament-timer";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";
import { useNowTick } from "@/shared/hooks/use-now-tick";
import { formatLocalHm, formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { resolveRuleName, toSessionStatus } from "../session-fields";
import type { ChipPurchaseOption } from "../sheets";
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
	const { playerNames, seats } = useSessionSeats({
		heroSeatPosition,
		sessionId,
		sessionType: "cash_game",
		tableSize: session?.tableSize ?? null,
	});
	const status = toSessionStatus(session?.status ?? "");
	const journal = useSessionJournal({
		chipPurchaseOptions: NO_PURCHASE_OPTIONS,
		playerNames,
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

	const clock = computeSessionClock(journal.events, now);

	const lastUpdateAt = findLastStackUpdateAt(journal.events);
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
		lastUpdateLabel: lastUpdateAt === null ? null : formatLocalHm(lastUpdateAt),
		onEndSession: () => setIsEndSessionOpen(true),
		onEndSessionOpenChange: setIsEndSessionOpen,
		onCompleteSubmit: (values: { finalStack: number }) =>
			stack.complete(values),
		onPause: () => stack.pause(),
		onRecordStack: (values: { stackAmount: number }) =>
			stack.recordStack(values),
		onResume: () => stack.resume(),
		ruleName: resolveRuleName(session.ruleName, session.variant, "Cash game"),
		seats,
		stackFormatted: currentStack === null ? "—" : formatNumber(currentStack),
		staleness: describeStaleness(lastUpdateAt, now),
		totalBuyIn,
	};
}
