import { isEventAllowedInState } from "@sapphire2/db/constants/session-event-types";
import { useRef, useState } from "react";
import { useSessionSeats } from "@/features/live-sessions/hooks/use-session-seats";
import { useTournamentSession } from "@/features/live-sessions/hooks/use-tournament-session";
import { useTournamentStack } from "@/features/live-sessions/hooks/use-tournament-stack";
import { describeBlindLevel } from "@/features/live-sessions/utils/blind-level-view";
import { computeBigBlinds } from "@/features/live-sessions/utils/live-session-summary";
import { computeSessionClock } from "@/features/live-sessions/utils/session-clock";
import {
	describeStaleness,
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/session-staleness";
import { formatTimerDuration } from "@/features/live-sessions/utils/tournament-timer";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";
import { useNowTick } from "@/shared/hooks/use-now-tick";
import { formatLocalHm, formatNumber } from "@/utils/format-number";
import { resolveRuleName, toSessionStatus } from "../session-fields";
import type { TournamentCompleteValues } from "../sheets";
import type { TournamentStackValues } from "../tournament-quick-input";
import { useSessionJournal } from "../use-session-journal";

const TICK_MS = 1000;

function toMs(value: Date | string | number): number {
	return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function useTournamentCockpit(sessionId: string) {
	const { isUpdatingTimer, session, updateTimerStartedAt } =
		useTournamentSession(sessionId);
	const stack = useTournamentStack({ sessionId });
	const now = useNowTick(TICK_MS);
	const isKeyboardOpen = useKeyboardOpen();
	const [isEndSessionOpen, setIsEndSessionOpen] = useState(false);
	const shiftedPauseRef = useRef<number | null>(null);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const { playerNames, seats } = useSessionSeats({
		heroSeatPosition,
		sessionId,
		sessionType: "tournament",
		tableSize: session?.tableSize ?? null,
	});
	const status = toSessionStatus(session?.status ?? "");
	const journal = useSessionJournal({
		chipPurchaseOptions: stack.chipPurchaseTypes,
		playerNames,
		sessionId,
		sessionType: "tournament",
		status,
	});

	if (!session || journal.isEventsLoading) {
		return { isLoading: true as const };
	}

	const summary = session.summary;
	const currentStack = summary.currentStack;

	const clock = computeSessionClock(journal.events, now);
	const timerStartedAt = session.timerStartedAt;
	const isPaused = status === "paused";
	const blindLevel = describeBlindLevel(
		session.blindLevels,
		timerStartedAt,
		clock.pausedSinceMs ?? now,
		{ isPaused }
	);
	const bigBlinds = computeBigBlinds(currentStack, blindLevel?.bigBlind);
	const lastUpdateAt = findLastStackUpdateAt(journal.events);

	const onResume = () => {
		const pausedSinceMs = clock.pausedSinceMs;
		stack.resume();
		if (timerStartedAt === null || pausedSinceMs === null) {
			return;
		}
		if (shiftedPauseRef.current === pausedSinceMs) {
			return;
		}
		shiftedPauseRef.current = pausedSinceMs;
		updateTimerStartedAt(
			new Date(toMs(timerStartedAt) + (now - pausedSinceMs))
		);
	};

	return {
		avgText:
			summary.averageStack === null ? "—" : formatNumber(summary.averageStack),
		bbText: bigBlinds === null ? "— BB" : `${formatNumber(bigBlinds)} BB`,
		blindLevel,
		canRecordStack: isEventAllowedInState("update_stack", status),
		currentStack,
		elapsed: formatTimerDuration(clock.activeSeconds, { padHours: true }),
		isCompletePending: stack.isCompletePending,
		isEndSessionOpen,
		isKeyboardOpen,
		isLoading: false as const,
		isMasterLinked: Boolean(session.tournamentId),
		isPaused,
		isStackPending: stack.isStackPending,
		isUpdatingTimer,
		journal,
		lastUpdateLabel: lastUpdateAt === null ? null : formatLocalHm(lastUpdateAt),
		onCompleteSubmit: (values: TournamentCompleteValues) =>
			stack.complete(values),
		onEndSession: () => setIsEndSessionOpen(true),
		onEndSessionOpenChange: setIsEndSessionOpen,
		onPause: () => stack.pause(),
		onRecordStack: (values: TournamentStackValues) => stack.recordStack(values),
		onResume,
		onStartTimer: () => updateTimerStartedAt(new Date(now)),
		pausedElapsed: formatTimerDuration(clock.pausedSeconds, {
			padHours: true,
		}),
		remainText: `${summary.remainingPlayers ?? "—"}/${summary.totalEntries ?? "—"}`,
		remainingPlayers: summary.remainingPlayers,
		ruleName: resolveRuleName(session.ruleName, session.variant, "Tournament"),
		seats,
		stackFormatted: currentStack === null ? "—" : formatNumber(currentStack),
		staleness: describeStaleness(lastUpdateAt, now),
		totalEntries: summary.totalEntries,
	};
}
