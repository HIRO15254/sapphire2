import {
	isEventAllowedInState,
	SESSION_STATUSES,
	type SessionStatus,
} from "@sapphire2/db/constants/session-event-types";
import { useState } from "react";
import { useCashGameSession } from "@/features/live-sessions/hooks/use-cash-game-session";
import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";
import { useSessionSeats } from "@/features/live-sessions/hooks/use-session-seats";
import { variantLabel } from "@/features/live-sessions/utils/game-scene-formatters";
import { computeCashGamePL } from "@/features/live-sessions/utils/live-session-summary";
import {
	describeStaleness,
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/session-staleness";
import { formatTimerDuration } from "@/features/live-sessions/utils/tournament-timer";
import { useNowTick } from "@/shared/hooks/use-now-tick";
import { formatLocalHm, formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;

function toSessionStatus(value: string): SessionStatus {
	const match = SESSION_STATUSES.find((status) => status === value);
	return match ?? "completed";
}

function resolveRuleName(
	ruleName: string | null | undefined,
	variant: string | null | undefined
): string {
	const trimmed = ruleName?.trim();
	if (trimmed) {
		return trimmed;
	}
	return variant ? variantLabel(variant) : "Cash game";
}

export function useCashCockpit(sessionId: string) {
	const { session } = useCashGameSession(sessionId);
	const stack = useCashGameStack({ sessionId });
	const now = useNowTick(TICK_MS);
	const [isEndSessionOpen, setIsEndSessionOpen] = useState(false);

	const rawHeroSeat = session?.heroSeatPosition;
	const heroSeatPosition =
		typeof rawHeroSeat === "number" && rawHeroSeat >= 0 ? rawHeroSeat : null;
	const { seats } = useSessionSeats({
		heroSeatPosition,
		sessionId,
		sessionType: "cash_game",
		tableSize: session?.tableSize ?? null,
	});

	if (!session) {
		return { isLoading: true as const };
	}

	const status = toSessionStatus(session.status);
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

	const startedAtMs = session.startedAt
		? new Date(session.startedAt).getTime()
		: now;
	const elapsedSeconds = Math.max(
		0,
		Math.floor((now - startedAtMs) / MS_PER_SECOND)
	);

	const lastUpdateAt = findLastStackUpdateAt(session.events);
	const blind2 = session.blind2;

	return {
		bigBlinds:
			currentStack !== null && blind2
				? Math.round(currentStack / blind2)
				: null,
		chipRemoveTotal,
		defaultFinalStack: currentStack ?? undefined,
		displayPL,
		displayPLFormatted: displayPL === null ? "—" : formatProfitLoss(displayPL),
		elapsed: formatTimerDuration(elapsedSeconds, { padHours: true }),
		evDiff,
		evPLFormatted: showEvPL && evPL !== null ? formatProfitLoss(evPL) : null,
		isCompletePending: stack.isCompletePending,
		isEndSessionOpen,
		isLoading: false as const,
		isMasterLinked: Boolean(session.ringGameId),
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
		ruleName: resolveRuleName(session.ruleName, session.variant),
		seats,
		stackFormatted: currentStack === null ? "—" : formatNumber(currentStack),
		staleness: describeStaleness(lastUpdateAt, now),
		totalBuyIn,
	};
}
